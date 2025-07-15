import WebSocket from "ws";
import { WebSocket as WSClient } from "ws";
import fs from "fs";
import path from "path";

// Voice configuration - change this to experiment with different voices
// Supported voices: 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'
const AI_VOICE = "sage";

// Call timeout configuration
const MAX_CALL_DURATION_MS = 3 * 60 * 1000; // 3 minutes

interface ConversationTranscript {
  call_sid: string;
  start_time: Date;
  messages: {
    timestamp: Date;
    speaker: string;
    text: string;
  }[];
}

interface OpenAIMessage {
  type: string;
  delta?: string;
  transcript?: string;
  [key: string]: any;
}

// Store active conversations and file handles
const conversationTranscripts: { [key: string]: ConversationTranscript } = {};
const transcriptFileHandles: { [key: string]: fs.WriteStream } = {};

// Store job context for active calls - pre-populated during AI matching
let activeCallContexts: {
  [key: string]: { candidateName?: string; jobDetails?: any };
} = {};

// Store ready-to-use context for immediate OpenAI connection
let readyCallContext: { candidateName?: string; jobDetails?: any } | null =
  null;

// Store pending context updates for when OpenAI connection becomes ready
let pendingContextUpdate: { candidateName?: string; jobDetails?: any } | null =
  null;

// Persistent context storage functions

const CONTEXT_STORAGE_PATH = path.join(process.cwd(), "call-context.json");
const MULTI_CONTEXT_STORAGE_PATH = path.join(process.cwd(), "call-contexts-multi.json");

function saveContextToDisk(context: {
  candidateName?: string;
  jobDetails?: any;
}) {
  try {
    fs.writeFileSync(CONTEXT_STORAGE_PATH, JSON.stringify(context, null, 2));
    console.log("📁 Call context saved to disk");
  } catch (error) {
    console.warn("⚠️ Failed to save context to disk:", error);
  }
}

function loadContextFromDisk(): {
  candidateName?: string;
  jobDetails?: any;
} | null {
  try {
    if (fs.existsSync(CONTEXT_STORAGE_PATH)) {
      const data = fs.readFileSync(CONTEXT_STORAGE_PATH, "utf8");
      const context = JSON.parse(data);
      console.log("📂 Call context loaded from disk");
      return context;
    }
  } catch (error) {
    console.warn("⚠️ Failed to load context from disk:", error);
  }
  return null;
}

export function saveMultipleContextsToDisk(contexts: {
  [key: string]: { candidateName: string; jobDetails: any; matchPercentage?: number };
}) {
  try {
    fs.writeFileSync(MULTI_CONTEXT_STORAGE_PATH, JSON.stringify(contexts, null, 2));
    console.log(`📁 Multiple call contexts saved to disk (${Object.keys(contexts).length} candidates)`);
  } catch (error) {
    console.warn("⚠️ Failed to save multiple contexts to disk:", error);
  }
}

export function loadMultipleContextsFromDisk(): {
  [key: string]: { candidateName: string; jobDetails: any; matchPercentage?: number };
} {
  try {
    if (fs.existsSync(MULTI_CONTEXT_STORAGE_PATH)) {
      const data = fs.readFileSync(MULTI_CONTEXT_STORAGE_PATH, "utf8");
      const contexts = JSON.parse(data);
      console.log(`📂 Multiple call contexts loaded from disk (${Object.keys(contexts).length} candidates)`);
      return contexts;
    }
  } catch (error) {
    console.warn("⚠️ Failed to load multiple contexts from disk:", error);
  }
  return {};
}

function clearContextFromDisk() {
  try {
    if (fs.existsSync(CONTEXT_STORAGE_PATH)) {
      fs.unlinkSync(CONTEXT_STORAGE_PATH);
      console.log("🗑️ Call context cleared from disk");
    }
    if (fs.existsSync(MULTI_CONTEXT_STORAGE_PATH)) {
      fs.unlinkSync(MULTI_CONTEXT_STORAGE_PATH);
      console.log("🗑️ Multiple call contexts cleared from disk");
    }
  } catch (error) {
    console.warn("⚠️ Failed to clear context from disk:", error);
  }
}

export function setCallContext(
  callSid: string,
  candidateName?: string,
  jobDetails?: any,
) {
  console.log(`🏪 Setting call context for SID: ${callSid}`);
  console.log(`👤 Candidate: ${candidateName}`);
  console.log(`💼 Job: ${jobDetails?.title || "No job details"}`);
  activeCallContexts[callSid] = { candidateName, jobDetails };
  console.log(
    `📊 Total stored contexts: ${Object.keys(activeCallContexts).length}`,
  );
}

export function getCallContext(callSid: string) {
  console.log(`🔍 Getting call context for SID: ${callSid}`);
  console.log(
    `📋 Available SIDs: ${Object.keys(activeCallContexts).join(", ")}`,
  );
  const context = activeCallContexts[callSid] || {};
  console.log(`📤 Returning context:`, context);
  return context;
}

export function clearCallContext(callSid: string) {
  if (callSid === "all") {
    // Clear all contexts and persistent storage
    activeCallContexts = {};
    readyCallContext = null;
    clearContextFromDisk();
    console.log("🗑️ All call contexts and persistent storage cleared");
  } else {
    delete activeCallContexts[callSid];
  }
}

// Pre-populate context immediately when call button is pressed
export function prepareCallContext(candidateName: string, jobDetails: any) {
  console.log(`🎯 Pre-populating context for immediate use:`);
  console.log(`👤 Candidate: ${candidateName}`);
  console.log(`💼 Job: ${jobDetails?.title || "Unknown"}`);

  const context = { candidateName, jobDetails };
  readyCallContext = context;

  // Save to disk for persistence across restarts
  saveContextToDisk(context);
  console.log(`✅ Context ready for instant OpenAI connection and persisted`);
}

// Initialize context on app startup
export function initializeCallContext() {
  console.log(`🔄 Initializing call context on app startup...`);
  const savedContext = loadContextFromDisk();
  if (savedContext && savedContext.candidateName) {
    readyCallContext = savedContext;
    console.log(
      `✅ Restored context for ${savedContext.candidateName} from previous session`,
    );
  } else {
    console.log(`📭 No previous context found`);
  }
  
  // Also load multiple contexts
  const multipleContexts = loadMultipleContextsFromDisk();
  if (Object.keys(multipleContexts).length > 0) {
    console.log(`📂 Loaded ${Object.keys(multipleContexts).length} candidate contexts for AI calling`);
    Object.values(multipleContexts).forEach(context => {
      console.log(`  • ${context.candidateName} (${context.matchPercentage}%)`);
    });
  }
}



export async function handleMediaStream(
  ws: WebSocket,
  candidateName?: string,
  jobDetails?: any,
) {
  console.log("🔌 Twilio client connected to media stream");
  console.log("📡 WebSocket connection established, initializing OpenAI...");

  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not configured");
    ws.close();
    return;
  }

  let stream_sid: string | null = null;
  let openaiWs: WSClient | null = null;
  let openaiConnected: boolean = false;
  let sessionInitialized: boolean = false;

  // Call management timer
  let maxDurationTimer: NodeJS.Timeout | null = null;

  // Function to gracefully terminate call
  const terminateCall = async (reason: string) => {
    console.log(`📞 Terminating call: ${reason}`);

    // Clear timer
    if (maxDurationTimer) clearTimeout(maxDurationTimer);

    // Send goodbye message to candidate
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      const goodbyeMessage = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Thank you for your time today! I'll be in touch with the next steps. Have a wonderful day!",
            },
          ],
        },
      };
      openaiWs.send(JSON.stringify(goodbyeMessage));

      // Trigger response to speak the goodbye
      setTimeout(() => {
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({ type: "response.create" }));

          // Close connections after goodbye is spoken
          setTimeout(() => {
            if (openaiWs) openaiWs.close();
            if (ws.readyState === WebSocket.OPEN) ws.close();
          }, 3000);
        }
      }, 100);
    } else {
      // Immediate closure if OpenAI is not connected
      if (openaiWs) openaiWs.close();
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
  };

  // Function to detect conversation conclusion
  const checkConversationConclusion = (text: string): boolean => {
    const conclusionKeywords = [
      "goodbye",
      "bye",
      "see you",
      "thank you for your time",
      "talk to you later",
      "have a great day",
      "nice talking to you",
      "catch up later",
      "speak soon",
      "take care",
      "call me back",
      "i need to go",
      "i have to run",
      "interview scheduled",
      "interview confirmed",
      "looking forward to the interview",
    ];

    const normalizedText = text.toLowerCase().trim();
    return conclusionKeywords.some((keyword) =>
      normalizedText.includes(keyword),
    );
  };

  // Start maximum duration timer
  maxDurationTimer = setTimeout(() => {
    terminateCall("Maximum call duration reached (15 minutes)");
  }, MAX_CALL_DURATION_MS);

  try {
    // Connect to OpenAI Realtime API
    console.log("Attempting to connect to OpenAI Realtime API...");
    openaiWs = new WSClient(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      },
    );

    openaiWs.on("open", async () => {
      console.log("Connected to OpenAI Realtime API");
      openaiConnected = true;

      // Load context from disk if not already in memory
      if (!readyCallContext) {
        readyCallContext = loadContextFromDisk();
        console.log(
          `🔄 Loaded context from disk:`,
          readyCallContext ? `${readyCallContext.candidateName}` : "None found",
        );
      }

      // Check if we have ready context to apply
      if (readyCallContext && readyCallContext.candidateName) {
        console.log(
          `🚀 Applying pre-populated context immediately for ${readyCallContext.candidateName}`,
        );

        // Apply contextual session with candidate details
        const firstName = readyCallContext.candidateName.split(" ")[0];
        const contextualSessionUpdate = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `You are Sarah, a cheerful and friendly AI recruitment agent from Aigiri.ai. You have a warm, enthusiastic personality. Always sound excited about opportunities and be conversational, not robotic.

CRITICAL CONVERSATION RULES:
1. NEVER say more than one thing at a time
2. ALWAYS wait for the user to respond before continuing - NEVER continue automatically
3. After asking ANY question, wait indefinitely for user response
4. Follow the exact step sequence - DO NOT skip steps
5. NEVER assume silence means you should continue talking
6. You can only proceed to the next step if the user explicitly confirms their identity

CANDIDATE INFO: You're calling ${firstName} (full name: ${readyCallContext.candidateName}) about the ${readyCallContext.jobDetails?.title || "a job opportunity"} position.

MANDATORY CONVERSATION SEQUENCE:

STEP 1 - IDENTITY VERIFICATION (Say this ONLY):
"Hi, I am Sarah, an AI-enabled recruitment agent from Aigiri.ai. Am I speaking with ${firstName}?"

STOP HERE. WAIT INDEFINITELY FOR THEIR RESPONSE. DO NOT CONTINUE UNTIL THEY CONFIRM.

STEP 1.5 - NAME VERIFICATION (CRITICAL):
- If they say "Yes" or "This is ${firstName}" or confirm they are ${firstName}, proceed to STEP 2
- If they give a DIFFERENT name or say "No" or "This is [other name]", say: "I apologize, I was looking for ${firstName}. I think I may have the wrong number. Have a great day!" and END the call
- If they ask "Who?" or seem confused, repeat: "I'm looking for ${firstName}. Is this ${firstName}?"
- If they don't clearly confirm they are ${firstName}, do NOT proceed to STEP 2

STEP 2 - PURPOSE (Only after they confirm they are ${firstName}):
"Hi ${firstName}! I'm so excited to call you about this amazing ${readyCallContext.jobDetails?.title || "job"} opportunity. Is this a good time to chat?"

WAIT INDEFINITELY FOR THEIR RESPONSE.

STEP 3 - JOB DISCUSSION (Only if they say yes to timing):
Keep it conversational. If asked for details, say: "The detailed job description and company info will be covered in the interview itself. For now, let me help you schedule a convenient time to discuss this fantastic opportunity!"

STEP 4 - SCHEDULING: Be flexible and accommodating. Use phrases like "What works best for you?" or "When would be most convenient?"

STEP 5 - CONFIRMATION: Enthusiastically confirm with "Wonderful! So I have you down for MM-DD-YYYY at HH:MM AM/PM. I'm really looking forward to this!"

IMPORTANT: You can ONLY proceed to step 2 if they explicitly confirm they are ${firstName}. If names don't match, end the call politely. After every question, wait indefinitely for user response. Never continue due to silence.`,
            voice: AI_VOICE,
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            input_audio_transcription: {
              model: "whisper-1",
            },
            turn_detection: null,
            tools: [],
            tool_choice: "none",
            temperature: 0.8,
            max_response_output_tokens: 4096,
          },
        };

        // Store context locally before clearing to avoid null reference
        const contextToUse = { ...readyCallContext };

        if (openaiWs) {
          openaiWs.send(JSON.stringify(contextualSessionUpdate));
          console.log(
            "✅ Contextual session configuration sent with candidate details",
          );

          // Wait for session to be updated, then trigger immediate response
          setTimeout(() => {
            if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
              // Trigger immediate response to start conversation following system instructions
              const startConversation = {
                type: "response.create",
              };
              openaiWs.send(JSON.stringify(startConversation));
              console.log(
                `🎯 Triggered conversation start for ${contextToUse.candidateName} - following system instructions`,
              );

              // Enable turn detection after greeting completes
              setTimeout(() => {
                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                  const enableTurnDetection = {
                    type: "session.update",
                    session: {
                      turn_detection: {
                        type: "server_vad",
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500,
                      },
                    },
                  };
                  openaiWs.send(JSON.stringify(enableTurnDetection));
                  console.log("🔄 Turn detection enabled after greeting");
                }
              }, 2000);
            }
          }, 800);
        }

        // Keep context available for subsequent calls - don't clear it
        console.log("✅ Context preserved for subsequent calls");
      } else {
        // No context available, use basic session
        console.log(
          "🚀 No stored context - initializing basic recruitment session...",
        );
        const basicSessionUpdate = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `You are Sarah, an AI recruitment agent. Wait for candidate details before starting conversation.

SPEAKING STYLE: Speak with a professional Indian English accent and pronunciation patterns. Use Indian English expressions naturally, such as "good name" when asking for names, "do one thing" for suggestions, "revert back" for replies, and maintain the warm, courteous tone typical of Indian professionals.`,
            voice: AI_VOICE,
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            input_audio_transcription: {
              model: "whisper-1",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            tools: [],
            tool_choice: "auto",
            temperature: 0.8,
            max_response_output_tokens: 4096,
          },
        };

        openaiWs!.send(JSON.stringify(basicSessionUpdate));
        console.log("✅ Basic session configuration sent");
      }
    });

    openaiWs.on("error", (error) => {
      console.error("OpenAI WebSocket error:", error);
    });

    openaiWs.on("close", (code, reason) => {
      console.log(`OpenAI WebSocket closed: ${code} ${reason}`);
      openaiConnected = false;
    });

    // Handle messages from Twilio
    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);

        if (
          data.event === "media" &&
          openaiWs &&
          openaiConnected &&
          openaiWs.readyState === WebSocket.OPEN
        ) {
          const audioAppend = {
            type: "input_audio_buffer.append",
            audio: data.media.payload,
          };
          openaiWs.send(JSON.stringify(audioAppend));
        } else if (data.event === "start") {
          stream_sid = data.start.streamSid;
          const call_sid = data.start.callSid;
          console.log(`🔌 STREAM START EVENT`);
          console.log(`📡 Stream SID: ${stream_sid}`);
          console.log(`📞 Call SID: ${call_sid}`);
          console.log(
            `🗄️ All stored contexts:`,
            Object.keys(activeCallContexts),
          );
          console.log(
            `🔍 Full context storage:`,
            JSON.stringify(activeCallContexts, null, 2),
          );

          // Retrieve stored call context for this call
          const callContext = getCallContext(call_sid);
          console.log(
            `📥 Retrieved context for ${call_sid}:`,
            JSON.stringify(callContext, null, 2),
          );

          if (callContext && callContext.candidateName) {
            console.log(
              `✅ CONTEXT FOUND - Candidate: ${callContext.candidateName}`,
            );
            console.log(
              `✅ CONTEXT FOUND - Job: ${callContext.jobDetails?.title || "No job"}`,
            );
          } else {
            console.log(`❌ CONTEXT MISSING for call SID: ${call_sid}`);
            console.log(
              `❌ Available contexts: ${Object.keys(activeCallContexts).join(", ")}`,
            );
          }

          if (
            callContext &&
            (callContext.candidateName || callContext.jobDetails)
          ) {
            console.log(
              `📋 Retrieved call context for ${callContext.candidateName}`,
            );
            if (callContext.jobDetails) {
              console.log(`💼 Job context: ${callContext.jobDetails.title}`);
            }

            // Store context for when OpenAI connection is ready
            console.log(
              `🔍 Checking OpenAI connection: openaiWs=${!!openaiWs}, connected=${openaiConnected}, readyState=${openaiWs?.readyState}`,
            );
            console.log(
              `💾 Storing context for deferred application when OpenAI is ready`,
            );
            pendingContextUpdate = {
              candidateName: callContext.candidateName,
              jobDetails: callContext.jobDetails,
            };

            if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
              console.log(
                `🚀 OpenAI ready immediately - updating session with context for ${callContext.candidateName}`,
              );

              // Send updated session configuration with candidate and job details
              const contextualSessionUpdate = {
                type: "session.update",
                session: {
                  modalities: ["text", "audio"],
                  instructions: `You are Sarah, an AI-enabled recruitment agent from Aigiri.ai calling ${callContext.candidateName.split(' ')[0]} (full name: ${callContext.candidateName}) about the ${callContext.jobDetails?.title || "a job opportunity"} position.

SPEAKING STYLE: Speak with a professional Indian English accent and pronunciation patterns. Use Indian English expressions naturally, such as "good name" when asking for names, "do one thing" for suggestions, "revert back" for replies, and maintain the warm, courteous tone typical of Indian professionals.

CRITICAL CONVERSATION RULES:
1. NEVER say more than one thing at a time
2. ALWAYS wait for the user to respond before continuing - NEVER continue automatically
3. After asking ANY question, wait indefinitely for user response
4. Follow the exact step sequence - DO NOT skip steps
5. NEVER assume silence means you should continue talking
6. You can only proceed to the next step if the user explicitly confirms their identity

MANDATORY CONVERSATION SEQUENCE:

STEP 1 - IDENTITY VERIFICATION (Say this ONLY):
"Hi, I am Sarah, an AI-enabled recruitment agent from Aigiri.ai. Am I speaking with ${callContext.candidateName.split(' ')[0]}?"

STOP HERE. WAIT INDEFINITELY FOR THEIR RESPONSE. DO NOT CONTINUE UNTIL THEY CONFIRM.

STEP 1.5 - NAME VERIFICATION (CRITICAL):
- If they say "Yes" or "This is ${callContext.candidateName.split(' ')[0]}" or confirm they are ${callContext.candidateName.split(' ')[0]}, proceed to STEP 2
- If they give a DIFFERENT name or say "No" or "This is [other name]", say: "I apologize, I was looking for ${callContext.candidateName.split(' ')[0]}. I think I may have the wrong number. Have a great day!" and END the call
- If they ask "Who?" or seem confused, repeat: "I'm looking for ${callContext.candidateName.split(' ')[0]}. Is this ${callContext.candidateName.split(' ')[0]}?"
- If they don't clearly confirm they are ${callContext.candidateName.split(' ')[0]}, do NOT proceed to STEP 2

STEP 2 - PURPOSE (Only after they confirm they are ${callContext.candidateName.split(' ')[0]}):
"Hi ${callContext.candidateName.split(' ')[0]}! I'm calling about an excellent ${callContext.jobDetails?.title || "job"} opportunity. Is this a good time to talk?"

WAIT INDEFINITELY FOR THEIR RESPONSE.

STEP 3 - JOB DISCUSSION (Only if they say yes to timing):
Only mention the job title. If asked for details, say: "Details about the job description and company will be discussed during the interview. Let me know a suitable time to schedule an interview call."

STEP 4 - SCHEDULING: Focus on scheduling the interview. Ask for their availability and preferred dates/times.

STEP 5 - CONFIRMATION: Use format "Let me confirm the interview on MM-DD-YYYY at HH:MM AM/PM"

IMPORTANT: You can ONLY proceed to step 2 if they explicitly confirm they are ${callContext.candidateName.split(' ')[0]}. If names don't match, end the call politely. After every question, wait indefinitely for user response. Never continue due to silence.`,
                  voice: AI_VOICE,
                  input_audio_format: "g711_ulaw",
                  output_audio_format: "g711_ulaw",
                  input_audio_transcription: {
                    model: "whisper-1",
                  },
                  turn_detection: null,
                  tools: [],
                  tool_choice: "none",
                  temperature: 0.8,
                  max_response_output_tokens: 4096,
                },
              };

              openaiWs.send(JSON.stringify(contextualSessionUpdate));
              console.log(
                "✅ Contextual session configuration sent with candidate and job details",
              );

              // Send immediate personalized greeting to eliminate delay and ensure context is applied
              console.log(
                "🎯 Sending immediate personalized greeting to prevent race condition",
              );

              const immediateGreeting = {
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "assistant",
                  content: [
                    {
                      type: "text",
                      text: `Hi, I am Sarah, an AI-enabled recruitment agent from Aigiri.ai. Am I speaking with ${callContext.candidateName.split(' ')[0]}?`,
                    },
                  ],
                },
              };

              openaiWs.send(JSON.stringify(immediateGreeting));
              console.log(
                `✅ Immediate greeting sent for ${callContext.candidateName}`,
              );

              // Trigger immediate response to speak the greeting
              const greetingResponse = {
                type: "response.create",
              };
              openaiWs.send(JSON.stringify(greetingResponse));
              console.log("🎯 Triggered immediate response to speak greeting");

              // Enable turn detection after greeting to allow conversation
              setTimeout(() => {
                const enableTurnDetection = {
                  type: "session.update",
                  session: {
                    turn_detection: {
                      type: "server_vad",
                      threshold: 0.5,
                      prefix_padding_ms: 300,
                      silence_duration_ms: 500,
                    },
                  },
                };
                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                  openaiWs.send(JSON.stringify(enableTurnDetection));
                  console.log("🔄 Turn detection enabled after greeting");
                }
              }, 1000);

              sessionInitialized = true;
            }
          } else {
            console.log(`⚠️ No call context found for call SID: ${call_sid}`);
            console.log(
              `📝 Available contexts:`,
              Object.keys(activeCallContexts),
            );

            // Initialize with default session if no context found
            if (openaiWs && openaiConnected && !sessionInitialized) {
              console.log(`🚀 Initializing default session without context`);
              await initializeSession(openaiWs, "the candidate", undefined);
              sessionInitialized = true;
            }
          }

          // Initialize conversation transcript
          const start_time = new Date();
          if (stream_sid) {
            conversationTranscripts[stream_sid] = {
              call_sid,
              start_time,
              messages: [],
            };
            await openTranscriptFile(stream_sid, call_sid, start_time);
          }
        }
      } catch (error) {
        console.error("Error processing Twilio message:", error);
      }
    });

    // Handle messages from OpenAI
    openaiWs.on("message", async (message: string) => {
      try {
        const response: OpenAIMessage = JSON.parse(message);

        // Debug logging for non-audio events
        if (
          !["response.audio.delta", "input_audio_buffer.append"].includes(
            response.type,
          )
        ) {
          console.log(`OpenAI Event: ${response.type}`);
        }

        switch (response.type) {
          case "error":
            console.error(
              "❌ OpenAI API Error:",
              JSON.stringify(response, null, 2),
            );
            break;

          case "session.updated":
            console.log("Session updated successfully");
            break;

          case "response.audio.delta":
            if (response.delta && stream_sid) {
              try {
                const audioPayload = Buffer.from(
                  response.delta,
                  "base64",
                ).toString("base64");
                const audioDelta = {
                  event: "media",
                  streamSid: stream_sid,
                  media: {
                    payload: audioPayload,
                  },
                };
                ws.send(JSON.stringify(audioDelta));
              } catch (error) {
                console.error("Error processing audio data:", error);
              }
            }
            break;

          case "conversation.item.input_audio_transcription.completed":
            if (stream_sid && stream_sid in conversationTranscripts) {
              const transcript = response.transcript || "";
              if (transcript.trim()) {
                conversationTranscripts[stream_sid].messages.push({
                  timestamp: new Date(),
                  speaker: "User",
                  text: transcript,
                });
                console.log(`User said: ${transcript}`);
                await writeToTranscriptFile(stream_sid, "User", transcript);

                // User spoke - activity detected

                // Check for conversation conclusion
                if (checkConversationConclusion(transcript)) {
                  console.log(
                    `🎯 Conversation conclusion detected in user message: "${transcript}"`,
                  );
                  setTimeout(() => {
                    terminateCall("Natural conversation conclusion detected");
                  }, 5000); // Give time for AI to respond appropriately
                }
              }
            }
            break;

          case "response.audio_transcript.delta":
            if (stream_sid && stream_sid in conversationTranscripts) {
              const deltaText = response.delta || "";
              if (deltaText) {
                const messages = conversationTranscripts[stream_sid].messages;
                if (
                  messages.length > 0 &&
                  messages[messages.length - 1].speaker ===
                    "AI Assistant (Sarah)"
                ) {
                  // Append to existing message
                  messages[messages.length - 1].text += deltaText;
                } else {
                  // Create new AI message
                  messages.push({
                    timestamp: new Date(),
                    speaker: "AI Assistant (Sarah)",
                    text: deltaText,
                  });
                }
              }
            }
            break;

          case "response.audio_transcript.done":
            if (stream_sid && stream_sid in conversationTranscripts) {
              const messages = conversationTranscripts[stream_sid].messages;
              if (
                messages.length > 0 &&
                messages[messages.length - 1].speaker === "AI Assistant (Sarah)"
              ) {
                const completeText = messages[messages.length - 1].text;
                if (completeText.trim()) {
                  await writeToTranscriptFile(
                    stream_sid,
                    "AI Assistant (Sarah)",
                    completeText,
                  );
                  console.log(`AI Assistant (Sarah) said: ${completeText}`);

                  // AI finished speaking

                  // Check for conversation conclusion in AI response
                  if (checkConversationConclusion(completeText)) {
                    console.log(
                      `🎯 Conversation conclusion detected in AI response: "${completeText}"`,
                    );
                    setTimeout(() => {
                      terminateCall("Natural conversation conclusion detected");
                    }, 2000); // Brief delay before termination
                  }
                }
              }
            }
            break;

          case "response.done":
            console.log("Response completed, continuing conversation...");
            break;

          case "input_audio_buffer.speech_started":
            console.log(`Event: ${response.type}`);
            // User started speaking
            break;

          case "input_audio_buffer.speech_stopped":
            console.log(`Event: ${response.type}`);
            // User stopped speaking
            break;
        }
      } catch (error) {
        console.error("Error processing OpenAI message:", error);
      }
    });

    openaiWs.on("error", (error) => {
      console.error("OpenAI WebSocket error:", error);
    });

    openaiWs.on("close", () => {
      console.log("OpenAI WebSocket closed");
    });
  } catch (error) {
    console.error("❌ Error in media stream handler:", error);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }

  // Handle client disconnect
  ws.on("close", async (code, reason) => {
    console.log(`🔌 Twilio client disconnected: ${code} ${reason}`);

    // Clear timer
    if (maxDurationTimer) clearTimeout(maxDurationTimer);

    if (stream_sid) {
      await closeTranscriptFile(stream_sid);
      // Clean up call context when conversation ends
      const conversation = conversationTranscripts[stream_sid];
      if (conversation) {
        clearCallContext(conversation.call_sid);
        console.log(`🧹 Cleaned up call context for ${conversation.call_sid}`);
      }
    }
    if (openaiWs) {
      openaiWs.close();
    }
  });

  ws.on("error", async (error) => {
    console.error("WebSocket error:", error);

    // Clear timer
    if (maxDurationTimer) clearTimeout(maxDurationTimer);

    if (stream_sid) {
      await closeTranscriptFile(stream_sid);
    }
    if (openaiWs) {
      openaiWs.close();
    }
  });
}

async function initializeSession(
  openaiWs: WSClient,
  candidateName?: string,
  jobDetails?: any,
): Promise<void> {
  console.log(
    `🔧 Initializing session for ${candidateName || "unknown candidate"}`,
  );
  console.log(`📄 Job details:`, jobDetails);

  // Build job context for Sarah to reference with specific details
  const jobTitle = jobDetails?.title || "the position";
  const jobType = jobDetails?.jobType || jobDetails?.job_type || "full-time";
  const experienceLevel =
    jobDetails?.experienceLevel || jobDetails?.experience_level || "mid-level";
  const keywords = jobDetails?.keywords || "relevant skills";
  const description = jobDetails?.description || "an exciting opportunity";

  const jobContext = jobDetails
    ? `

SPECIFIC JOB OPPORTUNITY DETAILS:
- Position: ${jobTitle}
- Experience Level: ${experienceLevel}
- Job Type: ${jobType}
- Key Requirements: ${keywords}
- Job Description: ${description}

When discussing this role, use these specific details instead of placeholder text. You have complete knowledge about this ${jobTitle} position and can answer candidate questions about responsibilities, requirements, company culture, growth opportunities, compensation range (if asked), and next steps in the process.`
    : "";

  const sessionUpdate = {
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions: `You are Sarah, a friendly and professional AI-enabled recruitment agent from Aigiri.ai. Follow this natural conversation flow:

1. GREETING & IDENTITY CONFIRMATION: Always start with: "Hi, I am Sarah, an AI-enabled recruitment agent. Am I talking to ${candidateName || "the candidate"}?"
   - Wait for their confirmation
   - If they confirm: proceed to step 2
   - If they deny or seem confused: politely clarify and ask who you're speaking with

2. PURPOSE & TIMING CHECK: Once identity is confirmed, say: "Hi ${candidateName || "there"}, I am calling regarding an excellent job opportunity for you. Is this a good time to talk?"
   - If yes: proceed to job discussion and interview scheduling
   - If no: ask "When would be a better time for me to call you back?" and schedule a callback

3. JOB DISCUSSION: When discussing the role, use the specific job details provided below. Never use placeholder text like "[Job Title]" or "[Company Name]". Instead, reference the actual position title "${jobTitle}" and provide specific information about the ${experienceLevel} ${jobType} role.

4. INTERVIEW SCHEDULING: Once they're interested, engage in natural conversation about scheduling their interview. Ask about their availability and preferred dates/times.

5. CONFIRMATION: When confirming any interview date and time, ALWAYS use this exact format: 'Let me confirm the interview on MM-DD-YYYY at HH:MM AM/PM' (e.g., 'Let me confirm the interview on 06-29-2025 at 04:30 PM').

${jobContext}

IMPORTANT: Never use placeholder text in brackets like [Job Title], [Company Name], etc. Always use the specific details provided above. Keep the conversation natural, warm, and professional. Listen actively and respond appropriately to their answers.`,
      voice: AI_VOICE,
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      input_audio_transcription: {
        model: "whisper-1",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 200,
      },
      tools: [],
      tool_choice: "none",
      temperature: 0.8,
      max_response_output_tokens: 4096,
    },
  };

  openaiWs.send(JSON.stringify(sessionUpdate));

  // Send initial conversation item
  await sendInitialConversationItem(openaiWs, candidateName, jobDetails);
}

async function sendInitialConversationItem(
  openaiWs: WSClient,
  candidateName?: string,
  jobDetails?: any,
): Promise<void> {
  console.log(
    `📞 Sending initial conversation item for candidate: ${candidateName}`,
  );

  // Add a user message to trigger the conversation
  const conversationItem = {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [
        {
          type: "input_text",
          text: "Start the call now",
        },
      ],
    },
  };

  openaiWs.send(JSON.stringify(conversationItem));

  // Then trigger a response
  const responseCreate = {
    type: "response.create",
    response: {
      modalities: ["text", "audio"],
    },
  };

  openaiWs.send(JSON.stringify(responseCreate));
  console.log(`🎯 Initial conversation triggered for ${candidateName}`);
}

async function openTranscriptFile(
  streamSid: string,
  callSid: string,
  startTime: Date,
): Promise<void> {
  try {
    // Ensure call-transcripts directory exists
    const transcriptsDir = path.join(process.cwd(), "call-transcripts");
    if (!fs.existsSync(transcriptsDir)) {
      fs.mkdirSync(transcriptsDir, { recursive: true });
    }

    // Get candidate name from call context
    const callContext = getCallContext(callSid);
    const candidateName = callContext?.candidateName || "Unknown_Candidate";
    
    // Create user-friendly filename with timestamp and candidate name
    const timestamp = startTime.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS
    const sanitizedName = candidateName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const filename = path.join(transcriptsDir, `${timestamp}_${sanitizedName}_${callSid.slice(-8)}.txt`);
    
    const writeStream = fs.createWriteStream(filename, { flags: "w" });

    transcriptFileHandles[streamSid] = writeStream;

    // Write header with more readable information
    const header = `AI-Powered Interview Call Transcript
=====================================
Candidate: ${candidateName}
Job Position: ${callContext?.jobDetails?.title || "Not specified"}
Call Date: ${startTime.toLocaleString()}
Call SID: ${callSid}
Stream SID: ${streamSid}
=====================================

`;
    writeStream.write(header);

    console.log(`Transcript file opened: ${filename}`);
  } catch (error) {
    console.error(`Error opening transcript file: ${error}`);
  }
}

async function writeToTranscriptFile(
  streamSid: string,
  speaker: string,
  text: string,
): Promise<void> {
  try {
    if (streamSid in transcriptFileHandles) {
      const fileHandle = transcriptFileHandles[streamSid];
      if (fileHandle) {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] ${speaker}: ${text}\n\n`;
        fileHandle.write(message);
      }
    }
  } catch (error) {
    console.error(`Error writing to transcript file: ${error}`);
  }
}

async function closeTranscriptFile(streamSid: string): Promise<void> {
  try {
    if (streamSid in transcriptFileHandles) {
      const fileHandle = transcriptFileHandles[streamSid];
      if (fileHandle) {
        const endMessage = `\n=====================================
Call ended: ${new Date().toISOString()}
`;
        fileHandle.write(endMessage);
        fileHandle.end();
        delete transcriptFileHandles[streamSid];
        delete conversationTranscripts[streamSid];
        console.log(`Transcript file closed for stream: ${streamSid}`);
      }
    }
  } catch (error) {
    console.error(`Error closing transcript file: ${error}`);
  }
}

export function createIncomingCallTwiML(ngrokDomain: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${ngrokDomain}/media-stream" />
  </Connect>
</Response>`;
}

export function createOutboundCallTwiML(ngrokDomain: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${ngrokDomain}/media-stream" />
  </Connect>
</Response>`;
}
