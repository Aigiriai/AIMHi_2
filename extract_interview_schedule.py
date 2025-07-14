import re
import os
from datetime import datetime, timedelta
from dateutil import parser

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
        
        # Look for standardized confirmation format first (most reliable)
        standardized_pattern = r'confirm.*?interview.*?on\s*(\d{2}-\d{2}-\d{4})\s*at\s*(\d{1,2}:\d{2}\s*(?:AM|PM))'
        
        # Legacy patterns for older transcripts
        legacy_patterns = [
            r'scheduled.*?(?:for|on)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})',
            r'schedule.*?(?:on|for)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})',
            r'meeting.*?(?:on|for)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})',
            r'interview.*?(?:on|for)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})',
        ]
        
        # Check for standardized format first
        confirmed_slot = None
        standardized_match = re.search(standardized_pattern, content, re.IGNORECASE)
        
        if standardized_match:
            confirmed_slot = {
                'date_text': standardized_match.group(1).strip(),  # MM-DD-YYYY format
                'time_text': standardized_match.group(2).strip(),  # HH:MM AM/PM format
                'full_match': standardized_match.group(0),
                'format_type': 'standardized'
            }
        else:
            # Fall back to legacy patterns
            for pattern in legacy_patterns:
                matches = re.finditer(pattern, content, re.IGNORECASE | re.DOTALL)
                for match in matches:
                    confirmed_slot = {
                        'date_text': match.group(1).strip(),
                        'time_text': '',  # Will find time separately
                        'full_match': match.group(0),
                        'format_type': 'legacy'
                    }
                    break
                if confirmed_slot:
                    break
            
            # If we found a legacy date, look for time nearby
            if confirmed_slot:
                time_matches = re.findall(r'(\d{1,2}[:\.]?\d{0,2}\s*(?:AM|PM|am|pm))', content, re.IGNORECASE)
                if time_matches:
                    confirmed_slot['time_text'] = time_matches[-1]
        
        # If no confirmation pattern found, look for separate mentions
        if not confirmed_slot:
            # Find all date mentions (with and without year)
            date_patterns = [
                r'([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})',  # With year: "January 5th, 2041"
                r'(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?[A-Za-z]+\s+(?:of\s+)?\d{4})',  # "5th of Jan of 2041"
                r'([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)',  # Without year: "January 5th"
            ]
            time_pattern = r'(\d{1,2}[:\.]?\d{0,2}\s*(?:AM|PM|am|pm))'
            
            dates = []
            for pattern in date_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                dates.extend(matches)
            
            times = re.findall(time_pattern, content, re.IGNORECASE)
            
            if dates and times:
                confirmed_slot = {
                    'date_text': dates[-1],  # Use last mentioned date
                    'time_text': times[-1],  # Use last mentioned time
                    'full_match': f"{dates[-1]} at {times[-1]}"
                }
        
        # Process the extracted information
        result = {
            'formatted_date': '',
            'formatted_time': '',
            'raw_date_text': '',
            'raw_time_text': '',
            'full_text': ''
        }
        
        if confirmed_slot:
            result['raw_date_text'] = confirmed_slot['date_text']
            result['raw_time_text'] = confirmed_slot['time_text']
            result['full_text'] = confirmed_slot['full_match']
            
            # Parse date
            try:
                date_text = confirmed_slot['date_text']
                
                if 'tomorrow' in date_text.lower():
                    parsed_date = datetime.now() + timedelta(days=1)
                elif 'today' in date_text.lower():
                    parsed_date = datetime.now()
                elif confirmed_slot.get('format_type') == 'standardized':
                    # Handle MM-DD-YYYY format directly
                    parsed_date = datetime.strptime(date_text, '%m-%d-%Y')
                else:
                    # Handle legacy format
                    year_match = re.search(r'\b(\d{4})\b', date_text)
                    
                    if year_match:
                        parsed_date = parser.parse(date_text, fuzzy=True)
                    else:
                        parsed_date = parser.parse(date_text, fuzzy=True)
                        
                        if parsed_date.year == 1900:
                            current_date = datetime.now()
                            parsed_date = parsed_date.replace(year=current_date.year)
                            
                            if parsed_date < current_date:
                                parsed_date = parsed_date.replace(year=current_date.year + 1)
                
                result['formatted_date'] = parsed_date.strftime('%d-%m-%Y')
                
            except Exception as e:
                print(f"Error parsing date '{confirmed_slot['date_text']}': {e}")
            
            # Parse time
            try:
                time_str = confirmed_slot['time_text']
                
                if confirmed_slot.get('format_type') == 'standardized':
                    # Handle standardized HH:MM AM/PM format
                    time_match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', time_str, re.IGNORECASE)
                    if time_match:
                        hours = int(time_match.group(1))
                        minutes = int(time_match.group(2))
                        am_pm = time_match.group(3).upper()
                        
                        # Convert to 24-hour format
                        if am_pm == 'PM' and hours != 12:
                            hours += 12
                        elif am_pm == 'AM' and hours == 12:
                            hours = 0
                        
                        result['formatted_time'] = f"{hours:02d}:{minutes:02d}"
                else:
                    # Handle legacy time formats
                    if ':' in time_str or '.' in time_str:
                        time_parts = re.search(r'(\d{1,2})[:.](\d{2})', time_str)
                        if time_parts:
                            hours = int(time_parts.group(1))
                            minutes = int(time_parts.group(2))
                        else:
                            hour_match = re.search(r'(\d{1,2})', time_str)
                            hours = int(hour_match.group(1)) if hour_match else 0
                            minutes = 0
                    else:
                        hour_match = re.search(r'(\d{1,2})', time_str)
                        hours = int(hour_match.group(1)) if hour_match else 0
                        minutes = 0
                    
                    # Handle AM/PM for legacy format
                    if 'pm' in time_str.lower() and hours != 12:
                        hours += 12
                    elif 'am' in time_str.lower() and hours == 12:
                        hours = 0
                    
                    result['formatted_time'] = f"{hours:02d}:{minutes:02d}"
                
            except Exception as e:
                print(f"Error parsing time '{confirmed_slot['time_text']}': {e}")
        
        # Print results
        print(f"\n=== Interview Slot Extraction Results ===")
        print(f"Transcript file: {os.path.basename(transcript_file_path)}")
        
        if result['formatted_date']:
            print(f"Date: {result['formatted_date']}")
        else:
            print("Date: Not found")
            
        if result['formatted_time']:
            print(f"Time: {result['formatted_time']}")
        else:
            print("Time: Not found")
            
        if result['raw_date_text']:
            print(f"Raw date text: '{result['raw_date_text']}'")
            
        if result['raw_time_text']:
            print(f"Raw time text: '{result['raw_time_text']}'")
            
        if result['full_text']:
            print(f"Full match: '{result['full_text']}'")
        
        print("=" * 40)
        
        return result
        
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
    # extract_interview_slot('call-transcripts/call_CA4458b5a61eaab6666bd81ccb5831edbc_20250602_051334.txt')