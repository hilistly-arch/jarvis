import React, { useState } from 'react';
import { 
  Bot, 
  Paperclip, 
  Sparkles, 
  Mic, 
  Activity, 
  Send, 
  ArrowLeft,
  ChevronDown,
  Monitor,
  MoreHorizontal
} from 'lucide-react';
import { AgentInfo } from '../types/cockpit';
import { soundFx } from '../utils/audioSynthesizer';

interface BotDirectChatProps {
  agent: AgentInfo;
  onReturnToMissionControl: () => void;
  onSendMessage: (botName: string, text: string) => Promise<string>;
}

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
}

export const BotDirectChat: React.FC<BotDirectChatProps> = ({
  agent,
  onReturnToMissionControl,
  onSendMessage
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'bot',
      text: 'Three things need you today: the contract redline from legal, an offer letter waiting on your sign-off, and a 2:00 PM that lands on top of board prep.',
      timestamp: 'Today 7:30 AM'
    },
    {
      id: 'm2',
      sender: 'bot',
      text: 'Everyone in the 2:00 PM is free Thursday at 11:00. Holding the new invite until you confirm.',
      timestamp: 'Today 7:30 AM'
    },
    {
      id: 'm3',
      sender: 'user',
      text: 'Move it',
      timestamp: 'Today 7:31 AM'
    },
    {
      id: 'm4',
      sender: 'bot',
      text: 'Moved to Thursday at 11:00, with a note saying why. Your afternoon is clear for board prep.',
      timestamp: 'Today 7:31 AM'
    }
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isSending) return;

    const userText = inputVal.trim();
    setInputVal('');
    soundFx.playClick(1200);

    const newMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: 'Just now'
    };
    setMessages(prev => [...prev, newMsg]);

    setIsSending(true);
    try {
      const reply = await onSendMessage(agent.name, userText);
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: reply,
        timestamp: 'Just now'
      };
      setMessages(prev => [...prev, botMsg]);
      soundFx.playDataChirp();
    } catch {
      // fallback
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080B10] select-none">
      {/* Direct Chat Header */}
      <div className="h-12 px-6 border-b border-neutral-800/80 flex items-center justify-between bg-[#0A0D14]">
        {/* Left: Return button + Bot Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundFx.playClick(1000);
              onReturnToMissionControl();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-xs font-mono text-[#00F0FF] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Mission Control [JARVIS]</span>
          </button>

          <div className="h-4 w-px bg-neutral-800" />

          {/* Bot Origami Icon & Title */}
          <div className="flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${agent.avatarColor}25`,
                color: agent.accentColor,
                border: `1px solid ${agent.avatarColor}50`
              }}
            >
              <Bot className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1">
              {agent.name.split(' / ')[0]}
              <span className="text-neutral-500 font-normal">/</span>
            </h1>
          </div>
        </div>

        {/* Right: Model badge and utilities */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141822] border border-neutral-700/60 text-xs text-neutral-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Gemini 3.8 Flash</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </div>
          <button className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Viewport */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl w-full mx-auto space-y-4">
        {/* Date Divider */}
        <div className="flex justify-center my-4">
          <span className="text-[11px] text-neutral-500 font-medium">
            Today 7:30 AM
          </span>
        </div>

        {/* Message Bubbles matching OpenMausBot screenshot */}
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                  isUser
                    ? 'bg-[#2A2E37] text-white rounded-br-sm shadow-md'
                    : 'bg-[#181D26] text-neutral-200 rounded-bl-sm border border-neutral-800/80 shadow-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex justify-start">
            <div className="bg-[#181D26] rounded-2xl px-4 py-2.5 border border-neutral-800 text-xs text-neutral-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce delay-100" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce delay-200" />
              <span className="ml-1 text-[11px] font-mono text-cyan-300">{agent.name} is typing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Message Input Bar */}
      <div className="p-4 max-w-3xl w-full mx-auto">
        <form
          onSubmit={handleSend}
          className="relative flex items-center bg-[#151922] border border-neutral-800/80 rounded-2xl p-2 shadow-xl focus-within:border-cyan-500/50"
        >
          {/* Left icons: paperclip & hand/sparkle */}
          <div className="flex items-center gap-1 text-neutral-400 pl-1">
            <button
              type="button"
              onClick={() => soundFx.playClick(900)}
              className="p-1.5 hover:text-white rounded-lg hover:bg-neutral-800/60 transition-colors"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => soundFx.playClick(950)}
              className="p-1.5 hover:text-white rounded-lg hover:bg-neutral-800/60 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>
          </div>

          {/* Input Field */}
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={`Message ${agent.name.split(' / ')[0]}`}
            className="flex-1 bg-transparent px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
          />

          {/* Right icons: mic & waveform / send button */}
          <div className="flex items-center gap-1 pr-1 text-neutral-400">
            <button
              type="button"
              onClick={() => soundFx.playClick(1000)}
              className="p-1.5 hover:text-white rounded-lg hover:bg-neutral-800/60 transition-colors"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={!inputVal.trim() || isSending}
              className={`p-1.5 rounded-lg transition-colors ${
                inputVal.trim() 
                  ? 'bg-cyan-500/20 text-[#00F0FF] hover:bg-cyan-500/30' 
                  : 'hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              {inputVal.trim() ? <Send className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
