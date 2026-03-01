import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Loader2, Download, AlertCircle, Wand2, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Define the window interface for AI Studio
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  
  // Check for API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("Error checking API key:", e);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Assume success after dialog closes (race condition mitigation)
        setHasApiKey(true);
      }
    } catch (e) {
      console.error("Error selecting API key:", e);
      setError("Failed to select API key. Please try again.");
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setProgressMessage('Initializing generation...');

    try {
      // Create a new instance right before the call to ensure fresh key
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      setProgressMessage('Sending request to Veo...');
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview', // Using fast model for better UX
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio
        }
      });

      setProgressMessage('Video is being generated. This may take a moment...');
      
      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
        setProgressMessage('Still processing... almost there...');
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      if (operation.error) {
        const errorMessage = String(operation.error.message || "Unknown error during generation");
        throw new Error(errorMessage);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!downloadLink) {
        throw new Error("No video URL returned");
      }

      setProgressMessage('Fetching video...');
      
      // Fetch the video with the API key header
      const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);

    } catch (err: any) {
      console.error("Generation error:", err);
      // Handle the specific "Requested entity was not found" error for API keys
      if (err.message && err.message.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("API Key session expired or invalid. Please select your key again.");
      } else {
        setError(err.message || "Failed to generate video. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      setProgressMessage('');
    }
  };

  if (!hasApiKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="glass-panel p-12 rounded-3xl max-w-md w-full flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 mb-2">
            <Film size={32} />
          </div>
          <h2 className="text-3xl font-serif font-medium">Start Creating</h2>
          <p className="text-white/60 leading-relaxed">
            To generate high-quality AI videos with Veo, you need to connect your Google Cloud project with billing enabled.
          </p>
          <button
            onClick={handleSelectKey}
            className="mt-4 px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-full font-medium transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            Select API Key <Wand2 size={18} />
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-white/40 hover:text-white/60 underline mt-4"
          >
            Learn more about billing
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="glass-panel rounded-3xl p-8 mb-8">
        <h1 className="text-4xl md:text-5xl font-serif mb-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          DreamStream
        </h1>
        <p className="text-white/60 mb-8 font-light tracking-wide">
          Generate cinematic videos with Google Veo
        </p>

        <div className="space-y-6">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your dream video... (e.g., A neon hologram of a cat driving at top speed in a cyberpunk city)"
              className="w-full bg-black/20 border border-white/10 rounded-2xl p-6 text-lg text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all min-h-[120px] resize-none"
              disabled={isGenerating}
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
              <select 
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-xs text-white/70 focus:outline-none hover:bg-white/5 cursor-pointer"
                disabled={isGenerating}
              >
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Portrait</option>
              </select>
              <select 
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-xs text-white/70 focus:outline-none hover:bg-white/5 cursor-pointer"
                disabled={isGenerating}
              >
                <option value="720p">720p Fast</option>
                <option value="1080p">1080p HD</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={generateVideo}
              disabled={isGenerating || !prompt.trim()}
              className={`
                px-8 py-4 rounded-full font-medium flex items-center gap-3 transition-all
                ${isGenerating || !prompt.trim() 
                  ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20 hover:shadow-orange-900/40 transform hover:-translate-y-0.5 active:translate-y-0'}
              `}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Wand2 size={20} />
                  <span>Generate Video</span>
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200"
            >
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-8 text-center py-12"
            >
              <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white/60 font-light animate-pulse">{progressMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {videoUrl && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-8 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-2xl"
            >
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full h-auto aspect-video object-contain bg-black"
              />
              <div className="p-4 flex justify-between items-center bg-white/5 border-t border-white/5">
                <div className="text-xs text-white/40 font-mono uppercase tracking-wider">
                  Generated with Veo
                </div>
                <a 
                  href={videoUrl} 
                  download={`dreamstream-${Date.now()}.mp4`}
                  className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                  title="Download Video"
                >
                  <Download size={20} />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
