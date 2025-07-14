import re
import os
from datetime import datetime, timedelta
from dateutil import parser
from dateutil.relativedelta import relativedelta

def extract_interview_slot(transcript_file_path):
    """
    Extract interview date and time from transcript file.
    
    Args:
        transcript_file_path (str): Path to the transcript file
        
    Returns:
        dict: Contains extracted date, time, and raw text
    """
    try:
        # Read transcript file
        with open(transcript_file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Look for confirmation patterns first (most reliable)
        confirmation_patterns = [
            r'schedule.*?(?:on|for)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)\s*(?:at\s*)?(\d{1,2}[:\.]?\d{0,2}\s*(?:AM|PM|am|pm))',
            r'meeting.*?(?:on|for)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)\s*(?:at\s*)?(\d{1,2}[:\.]?\d{0,2}\s*(?:AM|PM|am|pm))',
            r'interview.*?(?:on|for)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)\s*(?:at\s*)?(\d{1,2}[:\.]?\d{0,2}\s*(?:AM|PM|am|pm))',
        ]
        
        # Check for confirmation patterns first
        confirmed_slot = None
        for pattern in confirmation_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE | re.DOTALL)
            for match in matches:
                confirmed_slot = {
                    'date_text': match.group(1).strip(),
                    'time_text': match.group(2).strip(),
                    'full_match': match.group(0)
                }
                break
            if confirmed_slot:
                break
        
        # If no confirmation pattern, fall back to separate date/time extraction
        if not confirmed_slot:
            # Date and time extraction patterns
            date_patterns = [
                r'([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)',  # June 29th, July 15th
                r'(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+)',  # 29th June, 15th July
                r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',          # 29-06-2025, 29/06/2025
                r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})',          # 2025-06-29
                r'(tomorrow|today|next\s+week)',            # relative dates
            ]
            
            time_patterns = [
                r'(\d{1,2}[:\.]?\d{0,2}\s*(?:AM|PM|am|pm))',  # 4:30 PM, 4PM, 4.30PM
                r'(morning|afternoon|evening)',                # general times
            ]
            
            # Find dates and times separately
            found_dates = []
            for pattern in date_patterns:
                matches = re.finditer(pattern, content, re.IGNORECASE)
                for match in matches:
                    found_dates.append(match.group(1).strip())
            
            found_times = []
            for pattern in time_patterns:
                matches = re.finditer(pattern, content, re.IGNORECASE)
                for match in matches:
                    found_times.append(match.group(1).strip())
            
            if found_dates and found_times:
                confirmed_slot = {
                    'date_text': found_dates[-1],  # Use last mentioned
                    'time_text': found_times[-1],  # Use last mentioned
                    'full_match': f"{found_dates[-1]} at {found_times[-1]}"
                }
        
        # Process the extracted information
        extracted_info = {
            'date': None,
            'time': None,
            'formatted_date': '',
            'formatted_time': '',
            'raw_date_text': '',
            'raw_time_text': ''
        }
        
        # Process dates
        if found_dates:
            # Use the last mentioned date (most likely the confirmed one)
            last_date = found_dates[-1]
            extracted_info['raw_date_text'] = last_date['text']
            
            try:
                # Parse relative dates
                if 'tomorrow' in last_date['text'].lower():
                    parsed_date = datetime.now() + timedelta(days=1)
                elif 'today' in last_date['text'].lower():
                    parsed_date = datetime.now()
                elif 'next week' in last_date['text'].lower():
                    parsed_date = datetime.now() + timedelta(weeks=1)
                else:
                    # Try to parse the date
                    parsed_date = parser.parse(last_date['text'], fuzzy=True)
                    
                    # If no year specified, assume current year or next year if date has passed
                    if parsed_date.year == 1900:  # default year from parser
                        current_date = datetime.now()
                        parsed_date = parsed_date.replace(year=current_date.year)
                        
                        # If the date has already passed this year, assume next year
                        if parsed_date < current_date:
                            parsed_date = parsed_date.replace(year=current_date.year + 1)
                
                extracted_info['date'] = parsed_date
                extracted_info['formatted_date'] = parsed_date.strftime('%d-%m-%Y')
                
            except Exception as e:
                print(f"Error parsing date '{last_date['text']}': {e}")
        
        # Process times
        if found_times:
            # Use the last mentioned time (most likely the confirmed one)
            last_time = found_times[-1]
            extracted_info['raw_time_text'] = last_time['text']
            
            try:
                # Handle general time mentions
                if 'morning' in last_time['text'].lower():
                    extracted_info['formatted_time'] = '09:00'
                elif 'afternoon' in last_time['text'].lower():
                    extracted_info['formatted_time'] = '14:00'
                elif 'evening' in last_time['text'].lower():
                    extracted_info['formatted_time'] = '18:00'
                else:
                    # Parse specific time
                    time_str = last_time['text']
                    
                    # Handle different time formats
                    if ':' in time_str or '.' in time_str:
                        # Extract hours and minutes
                        time_parts = re.search(r'(\d{1,2})[:.](\d{2})', time_str)
                        if time_parts:
                            hours = int(time_parts.group(1))
                            minutes = int(time_parts.group(2))
                            
                            # Handle AM/PM
                            if 'pm' in time_str.lower() and hours != 12:
                                hours += 12
                            elif 'am' in time_str.lower() and hours == 12:
                                hours = 0
                            
                            extracted_info['formatted_time'] = f"{hours:02d}:{minutes:02d}"
                    else:
                        # Handle hour-only format like "4 PM"
                        hour_match = re.search(r'(\d{1,2})', time_str)
                        if hour_match:
                            hours = int(hour_match.group(1))
                            
                            # Handle AM/PM
                            if 'pm' in time_str.lower() and hours != 12:
                                hours += 12
                            elif 'am' in time_str.lower() and hours == 12:
                                hours = 0
                            
                            extracted_info['formatted_time'] = f"{hours:02d}:00"
                
            except Exception as e:
                print(f"Error parsing time '{last_time['text']}': {e}")
        
        # Print results
        print(f"\n=== Interview Slot Extraction Results ===")
        print(f"Transcript file: {os.path.basename(transcript_file_path)}")
        
        if extracted_info['formatted_date']:
            print(f"Date: {extracted_info['formatted_date']}")
        else:
            print("Date: Not found")
            
        if extracted_info['formatted_time']:
            print(f"Time: {extracted_info['formatted_time']}")
        else:
            print("Time: Not found")
            
        if extracted_info['raw_date_text']:
            print(f"Raw date text: '{extracted_info['raw_date_text']}'")
            
        if extracted_info['raw_time_text']:
            print(f"Raw time text: '{extracted_info['raw_time_text']}'")
        
        print("=" * 40)
        
        return extracted_info
        
    except FileNotFoundError:
        print(f"Error: Transcript file not found: {transcript_file_path}")
        return None
    except Exception as e:
        print(f"Error processing transcript: {e}")
        return None

def process_all_transcripts():
    """Process all transcript files in the call-transcripts directory."""
    transcript_dir = 'call-transcripts'
    
    if not os.path.exists(transcript_dir):
        print(f"Transcript directory '{transcript_dir}' not found.")
        return
    
    transcript_files = [f for f in os.listdir(transcript_dir) if f.endswith('.txt')]
    
    if not transcript_files:
        print(f"No transcript files found in '{transcript_dir}'.")
        return
    
    print(f"Found {len(transcript_files)} transcript file(s). Processing...")
    
    results = []
    for filename in transcript_files:
        file_path = os.path.join(transcript_dir, filename)
        result = extract_interview_slot(file_path)
        if result:
            results.append(result)
    
    return results

# Example usage
if __name__ == "__main__":
    # Process all transcripts in the directory
    process_all_transcripts()
    
    # Or process a specific file
    # extract_interview_slot('call-transcripts/call_CA1234567890_20250601_143000.txt')