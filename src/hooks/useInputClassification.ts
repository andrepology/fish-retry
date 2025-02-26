import { useState, useEffect } from 'react';

export type InputType = 'ENTRY' | 'SEARCH' | 'POST';

export function useInputClassification() {
  const [inputType, setInputType] = useState<InputType>('ENTRY');
  const [isClassifying, setIsClassifying] = useState(false);

  const classifyInput = async (text: string): Promise<void> => {
    // Don't classify empty text
    if (!text) {
      console.log('Classification: Empty text → ENTRY');
      setInputType('ENTRY');
      return;
    }

    setIsClassifying(true);
    console.log('Starting classification for:', text);

    try {
      const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
      
      // Basic classification logic without API call for common patterns
      if (text.startsWith('/') || text.startsWith('?') || text.toLowerCase().startsWith('find') || text.toLowerCase().startsWith('search')) {
        console.log('Classification: Pattern match → SEARCH');
        setInputType('SEARCH');
        setIsClassifying(false);
        return;
      }

      if (text.toLowerCase().includes('post') || text.toLowerCase().includes('share') || text.toLowerCase().includes('publish')) {
        console.log('Classification: Pattern match → POST');
        setInputType('POST');
        setIsClassifying(false);
        return;
      }

      // Use the Groq API for more accurate classification, regardless of text length
      console.log('Sending to Groq API for classification');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a text classifier. Classify the user input as one of: ENTRY (private journal entry), SEARCH (keyword search for a person), or POST (public post to the internet). Respond with ONLY the classification word.'
            },
            {
              role: 'user',
              content: text
            }
          ],
          max_tokens: 10
        })
      });

      const data = await response.json();
      const classification = data.choices?.[0]?.message?.content?.trim().toUpperCase() || 'ENTRY';
      console.log('API classification result:', classification);
      
      let finalType: InputType = 'ENTRY'; // Store the classification in a local variable
      
      if (['ENTRY', 'SEARCH', 'POST'].includes(classification)) {
        finalType = classification as InputType;
      } else {
        // Default to ENTRY if classification is unclear
        console.log('Invalid classification, defaulting to ENTRY');
      }
      
      setInputType(finalType);
      
      // Log the final determined type, not the state variable
      console.log('Classification complete. Type:', finalType);
    } catch (error) {
      console.error('Error classifying input:', error);
      // Fall back to ENTRY on error
      setInputType('ENTRY');
      console.log('Classification complete. Type: ENTRY (after error)');
    } finally {
      setIsClassifying(false);
    }
  };

  return {
    inputType,
    isClassifying,
    classifyInput
  };
} 