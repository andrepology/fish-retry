import { useState, useRef } from "react";

export function useSpeechInteraction() {
  const [isRecording, setIsRecording] = useState(false);
  const [userSpeech, setUserSpeech] = useState("");
  const [fishResponse, setFishResponse] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Create a MediaRecorder for the provided audio stream.
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // When data is available, save it for later.
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;
    // Attach a one‑time "stop" event listener.
    mediaRecorderRef.current.addEventListener(
      "stop",
      async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        // Send the audio blob to the Groq whisper API for transcription.
        const transcription = await fetchTranscription(audioBlob);
        if (transcription) {
          setUserSpeech(transcription);
          // Now use the transcribed text to get the fish's response via OpenAI.
          const response = await fetchFishResponse(transcription);
          if (response) {
            setFishResponse(response);
          }
        }
      },
      { once: true }
    );
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Send the recorded audio to Groq's whisper transcription API.
  const fetchTranscription = async (audioBlob: Blob): Promise<string | null> => {
    const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
    const url = "https://api.groq.com/openai/v1/audio/transcriptions";

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");
    formData.append("model", "whisper-large-v3-turbo");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          // Note: Do not set the Content-Type header when sending FormData.
        },
        body: formData,
      });
      const data = await res.json();
      console.log("Transcription response:", data);
      return data.text; // Expecting { text: "transcribed text" }
    } catch (e) {
      console.error("Error transcribing audio:", e);
      return null;
    }
  };

  // Use OpenAI's API (here via chat-completion) to have the fish talk back.
  const fetchFishResponse = async (userSpeech: string): Promise<string | null> => {
    const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
    const url = "https://api.openai.com/v1/chat/completions";

    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a playful and witty fish that responds to the user's speech in a humorous manner. Keep the reply short and in a friendly tone.",
        },
        {
          role: "user",
          content: userSpeech,
        },
      ],
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Fish response data:", data);
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.error("Error fetching fish response:", e);
      return null;
    }
  };

  return {
    isRecording,
    userSpeech,
    fishResponse,
    startRecording,
    stopRecording,
  };
} 