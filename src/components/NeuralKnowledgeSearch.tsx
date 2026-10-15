import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Brain, 
  Sparkles, 
  X, 
  ChevronRight, 
  ArrowRight, 
  Zap, 
  Layers, 
  Database, 
  Cpu, 
  Compass, 
  Flame,
  CornerDownLeft,
  Command
} from 'lucide-react';
import { 
  INITIAL_NODES, 
  CATEGORY_COLORS, 
  PRESET_QUERIES, 
  VaultNode, 
  MemoryCategory 
} from './KarpathyVault3D';
import { soundFx } from '../utils/audioSynthesizer';

interface NeuralKnowledgeSearchProps {
  onNavigateToVault?: (nodeId: string, query?: string) => void;
  className?: string;
}

interface ScoredNode {
  node: VaultNode;
  score: number; // 0.0 - 1.0
  matchedTokens: string[];
}

export const NeuralKnowledgeSearch: React.FC<NeuralKnowledgeSearchProps> = ({
  onNavigateToVault,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global Keyboard Shortcut: Cmd+K, Ctrl+K or '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in another input/textarea
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        soundFx.playClick(1200);
        setIsOpen(true);
        inputRef.current?.focus();
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        soundFx.playClick(1200);
        setIsOpen(true);
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute Search Matches & Semantic Ranking
  const searchResults = useMemo<ScoredNode[]>(() => {
    const cleanQuery = query.trim().toLowerCase();
    const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

    // Filter by category first if chosen
    const candidateNodes = selectedCategory === 'all' 
      ? INITIAL_NODES 
      : INITIAL_NODES.filter(n => n.category === selectedCategory);

    if (queryTokens.length === 0) {
      // Return top nodes sorted by access frequency and base weight
      return candidateNodes
        .slice()
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 7)
        .map(node => ({
          node,
          score: Number((node.baseWeight * 0.95).toFixed(3)),
          matchedTokens: []
        }));
    }

    const scored: ScoredNode[] = [];

    for (const node of candidateNodes) {
      let score = 0;
      const matchedTokens: string[] = [];
      const labelLower = node.label.toLowerCase();
      const snippetLower = node.chunkSnippet.toLowerCase();
      const idLower = node.id.toLowerCase();
      const categoryLower = node.category.toLowerCase();

      // Check each token
      for (const token of queryTokens) {
        let tokenMatched = false;

        // Exact match in label: high weight
        if (labelLower === token) {
          score += 45;
          tokenMatched = true;
        } else if (labelLower.includes(token)) {
          score += 30;
          tokenMatched = true;
        }

        // Match in snippet: medium weight
        if (snippetLower.includes(token)) {
          score += 20;
          tokenMatched = true;
        }

        // Match in ID or category
        if (idLower.includes(token) || categoryLower.includes(token)) {
          score += 15;
          tokenMatched = true;
        }

        if (tokenMatched) {
          matchedTokens.push(token);
        }
      }

      // If at least one token matched or query is partial
      if (matchedTokens.length > 0) {
        // Boost by access count and current recall weight
        const accessBoost = Math.min(15, (node.accessCount / 1420) * 15);
        const weightBoost = node.currentRecallWeight * 10;
        const totalRaw = score + accessBoost + weightBoost;
        
        // Normalize to a 0.0 - 1.0 cosine relevance approximation
        const normScore = Math.min(0.99, Number((0.65 + (totalRaw / 150) * 0.34).toFixed(3)));

        scored.push({
          node,
          score: normScore,
          matchedTokens
        });
      }
    }

    // Sort by descending score
    return scored.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [query, selectedCategory]);

  // Handle keyboard navigation inside search list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % searchResults.length);
      soundFx.playClick(900);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
      soundFx.playClick(900);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = searchResults[selectedIndex];
      if (selected) {
        handleInspectNode(selected.node.id);
      }
    }
  };

  const handleInspectNode = (nodeId: string) => {
    soundFx.playNodeSelect();
    setIsOpen(false);
    onNavigateToVault?.(nodeId, query);
  };

  const handleSelectPresetQuery = (presetQuery: string) => {
    soundFx.playDataChirp();
    setQuery(presetQuery);
    inputRef.current?.focus();
  };

  // Helper to highlight query matches in snippet
  const renderHighlightedText = (text: string, matchedTokens: string[]) => {
    if (!matchedTokens.length || !query.trim()) {
      return <span>{text}</span>;
    }

    // Create regex matching any of the tokens
    const escaped = matchedTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (!escaped) return <span>{text}</span>;

    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-[#ff8a1f]/30 text-amber-200 font-semibold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      
      {/* Search Input Trigger Bar */}
      <div 
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0a0d16]/90 border transition-all duration-200 ${
          isOpen 
            ? 'border-[#ff8a1f] shadow-[0_0_15px_rgba(255,138,31,0.25)] bg-[#0c101c]' 
            : 'border-white/[0.12] hover:border-[#ff8a1f]/50 hover:bg-[#0e1322]'
        }`}
      >
        <Brain className={`w-3.5 h-3.5 shrink-0 transition-colors ${isOpen ? 'text-[#ff8a1f] animate-pulse' : 'text-[#ffb259]'}`} />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            soundFx.playClick(1100);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Neural Knowledge Search..."
          className="w-44 md:w-56 lg:w-72 bg-transparent text-xs text-white placeholder:text-neutral-500 font-mono outline-none truncate"
        />

        {query ? (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="text-neutral-500 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[9px] font-mono text-neutral-400">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>
        )}
      </div>

      {/* Floating Insights Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-[480px] sm:w-[560px] max-w-[94vw] bg-[#0c0906]/98 border border-[#ff8a1f]/40 rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-xl z-50 overflow-hidden text-xs font-mono animate-fadeIn">
          
          {/* Dropdown Header: Title & Category Filters */}
          <div className="px-3.5 py-2.5 bg-[#140e08] border-b border-[#ff8a1f]/20 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-[#ff8a1f]/15 border border-[#ff8a1f]/40 text-[#ff8a1f]">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-condensed font-bold text-white tracking-wider text-xs">
                  <span>NEURAL RAG RETRIEVAL</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    KARPATHY VAULT
                  </span>
                </div>
                <div className="text-[9px] text-[#9a8878]">
                  Sub-millisecond cosine search across 21 high-dimensional memory embeddings
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 bg-[#0a0705] p-0.5 rounded-md border border-[#ff8a1f]/20 text-[9px]">
              {[
                { id: 'all', label: 'ALL' },
                { id: 'semantic', label: 'SEM' },
                { id: 'episodic', label: 'EPI' },
                { id: 'working', label: 'WORK' },
                { id: 'tools', label: 'TOOL' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    soundFx.playClick(1000);
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-1.5 py-0.5 rounded transition-all uppercase ${
                    selectedCategory === cat.id
                      ? 'bg-[#ff8a1f] text-black font-bold shadow-sm'
                      : 'text-[#9a8878] hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Preset Queries (when query is short or empty) */}
          {!query && (
            <div className="px-3.5 py-2 bg-[#0e0a06] border-b border-neutral-800/80">
              <div className="text-[9px] text-[#9a8878] mb-1.5 font-semibold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-[#ff8a1f]" />
                QUICK INSIGHT PROMPTS:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_QUERIES.map((pq, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPresetQuery(pq.query)}
                    className="px-2 py-0.5 rounded text-[9px] bg-[#160f0a] hover:bg-[#ff8a1f]/20 text-[#c8b8a8] hover:text-white border border-[#ff8a1f]/20 hover:border-[#ff8a1f]/50 transition-colors truncate max-w-full"
                  >
                    {pq.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results List */}
          <div className="max-h-[380px] overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {searchResults.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 font-mono text-xs">
                <Brain className="w-6 h-6 mx-auto mb-2 text-neutral-600 animate-pulse" />
                <div>No matching knowledge chunks found in latent manifold.</div>
                <div className="text-[10px] text-neutral-600 mt-1">Try querying "attention", "transformer", "kv-cache", or "intent"</div>
              </div>
            ) : (
              searchResults.map((item, idx) => {
                const node = item.node;
                const catConfig = CATEGORY_COLORS[node.category];
                const isSelected = idx === selectedIndex;
                const isExpanded = expandedInsightId === node.id;

                return (
                  <div
                    key={node.id}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`rounded-lg border transition-all duration-150 p-2.5 ${
                      isSelected
                        ? 'bg-[#181008] border-[#ff8a1f]/60 shadow-[0_0_12px_rgba(255,138,31,0.2)]'
                        : 'bg-[#100b07] border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {/* Header: Label, Category, Relevance Score */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: catConfig.css }} 
                        />
                        <span className="font-condensed font-bold text-xs text-white truncate">
                          {node.label}
                        </span>
                        <span 
                          className="px-1.5 py-0.2 rounded text-[8px] uppercase tracking-wider font-semibold shrink-0"
                          style={{ color: catConfig.css, backgroundColor: `${catConfig.css}18` }}
                        >
                          {catConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                          {Math.round(item.score * 100)}% MATCH
                        </span>
                      </div>
                    </div>

                    {/* Quick Insight Knowledge Snippet */}
                    <div className="text-[11px] text-[#cfbeae] leading-relaxed mb-2 font-sans pl-3 border-l-2 border-[#ff8a1f]/30">
                      {renderHighlightedText(node.chunkSnippet, item.matchedTokens)}
                    </div>

                    {/* Telemetry Chips & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] font-mono pt-1.5 border-t border-neutral-800/80">
                      <div className="flex items-center gap-2 text-[#9a8878]">
                        <span>ACCESS: <b className="text-amber-400">{node.accessCount.toLocaleString()}</b></span>
                        <span>TOKENS: <b className="text-white">{node.tokens}</b></span>
                        <span>DIM: <b className="text-cyan-300">{node.vectorDim}d</b></span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setExpandedInsightId(isExpanded ? null : node.id)}
                          className="px-2 py-0.5 rounded text-[9px] bg-[#140d07] hover:bg-[#ff8a1f]/20 text-[#ffb259] border border-[#ff8a1f]/30 transition-colors"
                        >
                          {isExpanded ? 'LESS DETAILS' : 'QUICK INSIGHT'}
                        </button>

                        <button
                          onClick={() => handleInspectNode(node.id)}
                          className="px-2.5 py-0.5 rounded bg-[#ff8a1f] hover:bg-[#ffb259] text-black font-condensed font-bold text-[10px] tracking-wider flex items-center gap-1 transition-all shadow-[0_0_8px_rgba(255,138,31,0.4)]"
                        >
                          <span>INSPECT IN 3D</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Epistemic Vector Preview */}
                    {isExpanded && (
                      <div className="mt-2.5 p-2 rounded bg-[#090604] border border-neutral-800 text-[9px] space-y-1.5 animate-fadeIn">
                        <div className="flex items-center justify-between text-[#ffb259]">
                          <span className="font-semibold">LATENT EMBEDDING SAMPLE (1536-D):</span>
                          <span className="text-[#9a8878]">Attention Weight: {node.currentRecallWeight}</span>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 font-mono text-[8px] text-cyan-300">
                          {node.embeddingPreview.map((val, i) => (
                            <div key={i} className="bg-cyan-950/40 p-1 rounded border border-cyan-800/30 text-center">
                              {val > 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-neutral-400 italic">
                          💡 Quick Insight: Force-directed manifold automatically pulls correlated memory chunks along attention edges with sub-millisecond retrieval latency.
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

          {/* Dropdown Footer: Keyboard Hints & 3D Direct Jump */}
          <div className="px-3.5 py-2 bg-[#120c07] border-t border-[#ff8a1f]/20 flex items-center justify-between text-[9px] text-[#9a8878]">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-neutral-800 rounded text-neutral-300">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-neutral-800 rounded text-neutral-300">↵</kbd> Select & Inspect
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-neutral-800 rounded text-neutral-300">Esc</kbd> Close
              </span>
            </div>

            <button
              onClick={() => {
                soundFx.playClick(1200);
                setIsOpen(false);
                onNavigateToVault?.('vault-centroid');
              }}
              className="text-[#ffb259] hover:text-white flex items-center gap-1 underline font-semibold transition-colors"
            >
              <span>Explore Full 3D Vault</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
