import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Edit3, 
  Bot, 
  Cpu, 
  Database, 
  CheckCircle2, 
  GitBranch, 
  ArrowRight, 
  Sliders, 
  Maximize2, 
  Minimize2,
  RotateCcw,
  Sparkles,
  Layers,
  Activity,
  Terminal,
  ShieldCheck,
  Share2,
  Play,
  Pause,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Eye,
  RefreshCw,
  Brain
} from 'lucide-react';
import { AgentInfo, AgentId, QuickTriggerAction } from '../types/cockpit';
import { soundFx } from '../utils/audioSynthesizer';
import { PipelineEfficiencyChart } from './PipelineEfficiencyChart';

export interface WorkflowExecutionLogEntry {
  id: string;
  timestamp: string; // Event-specific timestamp with ms e.g. "14:28:42.195"
  deltaMs: number; // Latency offset since dispatch
  sourceNodeId?: string;
  sourceNodeTitle?: string;
  targetNodeId?: string;
  targetNodeTitle?: string;
  status: 'PENDING' | 'DISPATCHED' | 'PROCESSING' | 'TRANSITIONED' | 'COMPLETED' | 'NOMINAL';
  phaseCategory: 'trigger' | 'prompt' | 'agent' | 'parser' | 'recall' | 'bundle' | 'success';
  message: string;
  payloadBadge?: string;
  modelBadge?: string;
  latencyMs?: number;
}

interface WorkflowNode {
  id: string;
  title: string;
  category: 'trigger' | 'prompt' | 'agent' | 'parser' | 'recall' | 'bundle' | 'success';
  subtitle?: string;
  icon: 'zap' | 'edit' | 'bot' | 'database' | 'code' | 'bundle' | 'check';
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'nominal' | 'active' | 'executing' | 'success';
  modelTag?: string;
  agentId?: AgentId;
}

interface WorkflowConnection {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

// Specific node logic & reasoning thought metadata for each workflow node
export const NODE_AGENT_THOUGHTS: Record<string, { thought: string; focus: string }> = {
  'node-trigger': {
    thought: 'Monitoring webhook dispatch event bus and synchronizing swarm clock frequency.',
    focus: 'Pipeline Dispatch & Triggers'
  },
  'node-prompt': {
    thought: 'Decomposing directives into structured context vectors and multi-agent task matrices.',
    focus: 'Prompt Engineering & Intent Matrix'
  },
  'node-agent-ceo': {
    thought: 'Evaluating multi-agent consensus thresholds, verifying milestone convergence, and orchestrating execution mandates.',
    focus: 'Executive Orchestration & Consensus'
  },
  'node-agent-architect': {
    thought: 'Traversing the 1536-D Karpathy Vault latent manifold, auditing graph connectivity, and enforcing C4 boundary contracts.',
    focus: 'C4 Architecture & Latent Manifold'
  },
  'node-agent-dev': {
    thought: 'Compiling reactive full-stack AST modules, performing inline optimizations, and asserting zero dead code paths.',
    focus: 'TypeScript & AST Code Generation'
  },
  'node-agent-qa': {
    thought: 'Executing sandboxed regression assertions, checking security boundaries, and verifying zero memory leak invariants.',
    focus: 'Security Sandbox & Boundary Guard'
  },
  'node-parse-1': {
    thought: 'Validating structured JSON schema conformance, sanitizing payload types, and rejecting malformed token sequences.',
    focus: 'JSON Schema & Structured Parser'
  },
  'node-recall-rag': {
    thought: 'Performing high-speed cosine similarity retrieval across wiki/ and raw/ vector chunks in sub-millisecond latency.',
    focus: 'Karpathy Vault Cosine RAG Recall'
  },
  'node-parse-qa': {
    thought: 'Verifying process isolation in sandbox container, checking memory limits, and guaranteeing Exit Code 0.',
    focus: 'Container Sandbox & Exit Code 0'
  },
  'node-processor-1': {
    thought: 'Normalizing executive telemetry vectors, synchronizing color palettes, and formatting responsive UI data.',
    focus: 'Executive Telemetry Synthesizer'
  },
  'node-processor-2': {
    thought: 'Packaging distribution artifacts into outputs/ directory, generating SHA-256 manifests, and bundling assets.',
    focus: 'Production Deliverables Compiler'
  },
  'node-bundle': {
    thought: 'Aggregating parallel agent outputs into unified atomic release manifest and preparing final validation checkpoint.',
    focus: 'Multi-Agent Consensus Bundling'
  },
  'node-success': {
    thought: 'Confirming flawless pipeline execution with 100% test pass rate, verified state commutations, and zero founder fatigue.',
    focus: 'Execution Accomplishment & Telemetry'
  }
};

interface WorkflowCanvasProps {
  agents: AgentInfo[];
  executingAction: QuickTriggerAction | null;
  onSelectAgent: (id: AgentId) => void;
  onExecuteWorkflow: () => void;
  thoughtLatencyMs?: number;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  agents,
  executingAction,
  onSelectAgent,
  onExecuteWorkflow,
  thoughtLatencyMs = 1820
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logListRef = useRef<HTMLDivElement | null>(null);

  // Pipeline Efficiency Line Chart visibility toggle
  const [showEfficiencyChart, setShowEfficiencyChart] = useState<boolean>(true);

  // Pan & Zoom state
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [zoom, setZoom] = useState(0.92);
  const isDraggingRef = useRef(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Hover state for Agent Thought Bubble Popup
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const handleNodeMouseEnter = (nodeId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    soundFx.playClick(1400);
    setHoveredNodeId(nodeId);
  };

  const handleNodeMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredNodeId(null);
    }, 180);
  };

  // ---------------------------------------------------------------------------
  // REAL-TIME WORKFLOW EXECUTION LOG OVERLAY STATE
  // ---------------------------------------------------------------------------
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [logViewMode, setLogViewMode] = useState<'compact' | 'expanded'>('compact');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [logFilter, setLogFilter] = useState<'ALL' | 'TRANSITIONS' | 'AGENTS' | 'SUCCESS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTransition, setActiveTransition] = useState<{ from: string; to: string } | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Initial Real-time Execution Telemetry Log
  const [executionLogs, setExecutionLogs] = useState<WorkflowExecutionLogEntry[]>([
    {
      id: 'log-seed-1',
      timestamp: '14:20:01.104',
      deltaMs: 0,
      sourceNodeId: 'node-trigger',
      sourceNodeTitle: 'Executes Workflow',
      targetNodeId: 'node-prompt',
      targetNodeTitle: 'Create User Prompt',
      status: 'TRANSITIONED',
      phaseCategory: 'trigger',
      message: 'Workflow Trigger ingested: om7_cli input received on vector bus',
      payloadBadge: 'input.raw_event',
      modelBadge: 'OM-7 Event Gateway'
    },
    {
      id: 'log-seed-2',
      timestamp: '14:20:01.148',
      deltaMs: 44,
      sourceNodeId: 'node-prompt',
      sourceNodeTitle: 'Create User Prompt',
      targetNodeId: 'node-agent-ceo',
      targetNodeTitle: 'CEO Genesis Core',
      status: 'TRANSITIONED',
      phaseCategory: 'prompt',
      message: 'Synthesized context embeddings; fan-out to CEO & Specialist Squad',
      payloadBadge: '8k tokens',
      modelBadge: 'Gemini 3.8 Flash'
    },
    {
      id: 'log-seed-3',
      timestamp: '14:20:01.216',
      deltaMs: 68,
      sourceNodeId: 'node-agent-ceo',
      sourceNodeTitle: 'CEO Genesis Core',
      targetNodeId: 'node-parse-1',
      targetNodeTitle: 'Structured Output Parsed',
      status: 'TRANSITIONED',
      phaseCategory: 'agent',
      message: 'Strategic roadmap emitted; JSON schema validated with exit 0',
      payloadBadge: 'json_schema_v2',
      modelBadge: 'Gemini 3.8 Flash'
    },
    {
      id: 'log-seed-4',
      timestamp: '14:20:01.325',
      deltaMs: 109,
      sourceNodeId: 'node-recall-rag',
      sourceNodeTitle: 'Karpathy RAG Data Recall',
      targetNodeId: 'node-processor-1',
      targetNodeTitle: 'Executive Synthesizer',
      status: 'TRANSITIONED',
      phaseCategory: 'recall',
      message: 'Retrieved 14 wiki/ memory vectors with >0.94 cosine similarity',
      payloadBadge: '14 vectors',
      modelBadge: 'RAG Cosine Index'
    },
    {
      id: 'log-seed-5',
      timestamp: '14:20:01.440',
      deltaMs: 115,
      sourceNodeId: 'node-processor-1',
      sourceNodeTitle: 'Executive Synthesizer',
      targetNodeId: 'node-bundle',
      targetNodeTitle: 'Bundle Processed Data',
      status: 'TRANSITIONED',
      phaseCategory: 'bundle',
      message: 'Multi-agent consensus consolidated into single verifiable bundle',
      payloadBadge: 'bundle.manifest.json',
      modelBadge: 'Consensus 100%'
    },
    {
      id: 'log-seed-6',
      timestamp: '14:20:01.520',
      deltaMs: 80,
      sourceNodeId: 'node-bundle',
      sourceNodeTitle: 'Bundle Processed Data',
      targetNodeId: 'node-success',
      targetNodeTitle: 'Success Status Generated',
      status: 'COMPLETED',
      phaseCategory: 'success',
      message: 'Workflow execution nominal: zero founder fatigue achieved',
      payloadBadge: 'STATUS: 200 OK',
      modelBadge: 'OM-7 Arc Core'
    }
  ]);

  // Define Nodes layout matching the video flow
  const nodes: WorkflowNode[] = [
    // Step 1: Trigger
    {
      id: 'node-trigger',
      title: 'Executes Workflow',
      category: 'trigger',
      subtitle: 'Trigger Input',
      icon: 'zap',
      agentId: 'ceo',
      x: 60,
      y: 280,
      width: 170,
      height: 82,
      status: executingAction ? 'executing' : 'nominal'
    },
    // Step 2: User Prompt Engine
    {
      id: 'node-prompt',
      title: 'Create User Prompt',
      category: 'prompt',
      subtitle: 'Trigger Vector Engine',
      icon: 'edit',
      agentId: 'pm',
      x: 300,
      y: 280,
      width: 180,
      height: 82,
      status: executingAction ? 'executing' : 'nominal'
    },

    // Step 3: Parallel Specialized Agents (Branched)
    {
      id: 'node-agent-ceo',
      title: 'CEO Genesis Core',
      category: 'agent',
      subtitle: 'Enterprise Orchestration',
      modelTag: 'Gemini 3.8 Flash',
      agentId: 'ceo',
      icon: 'bot',
      x: 580,
      y: 70,
      width: 200,
      height: 90,
      status: executingAction ? 'executing' : 'nominal'
    },
    {
      id: 'node-agent-architect',
      title: 'System Architect',
      category: 'agent',
      subtitle: 'C4 & Karpathy Vault',
      modelTag: 'Gemini 3.8 Flash',
      agentId: 'architect',
      icon: 'bot',
      x: 580,
      y: 190,
      width: 200,
      height: 90,
      status: executingAction ? 'executing' : 'nominal'
    },
    {
      id: 'node-agent-dev',
      title: 'Senior Dev Full-Stack',
      category: 'agent',
      subtitle: 'Zero Dead Code',
      modelTag: 'Gemini 3.8 Flash',
      agentId: 'dev',
      icon: 'bot',
      x: 580,
      y: 310,
      width: 200,
      height: 90,
      status: executingAction ? 'executing' : 'nominal'
    },
    {
      id: 'node-agent-qa',
      title: 'QA Auditor Guard',
      category: 'agent',
      subtitle: 'Safe Boundary Guard',
      modelTag: 'Drive C: Guard',
      agentId: 'qa',
      icon: 'bot',
      x: 580,
      y: 430,
      width: 200,
      height: 90,
      status: executingAction ? 'executing' : 'nominal'
    },

    // Step 4: Parsers & Downstream Processors
    {
      id: 'node-parse-1',
      title: 'Structured Output Parsed',
      category: 'parser',
      subtitle: 'JSON Schema Validation',
      icon: 'code',
      agentId: 'ba',
      x: 870,
      y: 130,
      width: 190,
      height: 80,
      status: 'nominal'
    },
    {
      id: 'node-recall-rag',
      title: 'Karpathy RAG Data Recall',
      category: 'recall',
      subtitle: 'wiki/ & raw/ Cosine Index',
      icon: 'database',
      agentId: 'architect',
      x: 870,
      y: 280,
      width: 195,
      height: 80,
      status: 'nominal'
    },
    {
      id: 'node-parse-qa',
      title: 'Sandbox Boundary Guard',
      category: 'parser',
      subtitle: 'Exit Code 0 Verification',
      icon: 'code',
      agentId: 'qa',
      x: 870,
      y: 430,
      width: 190,
      height: 80,
      status: 'nominal'
    },

    // Step 5: Processors
    {
      id: 'node-processor-1',
      title: 'Executive Synthesizer',
      category: 'parser',
      subtitle: 'Vector Normalizer',
      icon: 'code',
      agentId: 'designer',
      x: 1140,
      y: 200,
      width: 180,
      height: 76,
      status: 'nominal'
    },
    {
      id: 'node-processor-2',
      title: 'Deliverables Compiler',
      category: 'parser',
      subtitle: 'outputs/ Packager',
      icon: 'code',
      agentId: 'dev',
      x: 1140,
      y: 340,
      width: 180,
      height: 76,
      status: 'nominal'
    },

    // Step 6: Bundle Processed Data
    {
      id: 'node-bundle',
      title: 'Bundle Processed Data',
      category: 'bundle',
      subtitle: 'Multi-Agent Consensus',
      icon: 'bundle',
      agentId: 'pm',
      x: 1390,
      y: 270,
      width: 195,
      height: 84,
      status: executingAction ? 'executing' : 'nominal'
    },

    // Step 7: Success Status Generated (with Expanding Bioluminescent Aura)
    {
      id: 'node-success',
      title: 'Success Status Generated',
      category: 'success',
      subtitle: 'Zero Founder Fatigue',
      icon: 'check',
      agentId: 'ceo',
      x: 1660,
      y: 270,
      width: 205,
      height: 84,
      status: 'success'
    }
  ];

  // Pipeline Wire Connections matching the video's branching paths
  const connections: WorkflowConnection[] = [
    { from: 'node-trigger', to: 'node-prompt', color: '#FFB300' },
    
    // Prompt branches out into parallel agents
    { from: 'node-prompt', to: 'node-agent-ceo', color: '#00F0FF' },
    { from: 'node-prompt', to: 'node-agent-architect', color: '#00F0FF' },
    { from: 'node-prompt', to: 'node-agent-dev', color: '#00F0FF' },
    { from: 'node-prompt', to: 'node-agent-qa', color: '#00F0FF' },

    // Agents connect to parsers
    { from: 'node-agent-ceo', to: 'node-parse-1', color: '#FFB300' },
    { from: 'node-agent-architect', to: 'node-recall-rag', color: '#00F0FF' },
    { from: 'node-agent-dev', to: 'node-recall-rag', color: '#00F0FF' },
    { from: 'node-agent-qa', to: 'node-parse-qa', color: '#10B981' },

    // Parsers to Processors
    { from: 'node-parse-1', to: 'node-processor-1', color: '#FFB300' },
    { from: 'node-recall-rag', to: 'node-processor-1', color: '#00F0FF' },
    { from: 'node-recall-rag', to: 'node-processor-2', color: '#00F0FF' },
    { from: 'node-parse-qa', to: 'node-processor-2', color: '#10B981' },

    // Processors merge into Bundle
    { from: 'node-processor-1', to: 'node-bundle', color: '#FFB300' },
    { from: 'node-processor-2', to: 'node-bundle', color: '#00F0FF' },

    // Bundle into Success Status Generated
    { from: 'node-bundle', to: 'node-success', color: '#00F0FF' }
  ];

  // ---------------------------------------------------------------------------
  // FORMATTING & TELEMETRY UTILITIES
  // ---------------------------------------------------------------------------
  const formatPreciseTimestamp = (date: Date = new Date()) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  };

  // Center & zoom in on a specific node smoothly
  const focusNode = (nodeId?: string) => {
    if (!nodeId) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !containerRef.current) return;
    const cWidth = containerRef.current.clientWidth || 800;
    const cHeight = containerRef.current.clientHeight || 500;
    const targetX = cWidth / 2 - (node.x + node.width / 2) * zoom;
    const targetY = cHeight / 2 - (node.y + node.height / 2) * zoom;
    setPan({ x: targetX, y: targetY });
    setSelectedNodeId(nodeId);
    soundFx.playClick(1300);
  };

  // ---------------------------------------------------------------------------
  // REAL-TIME WORKFLOW EXECUTION PROGRESS SIMULATOR & DISPATCHER
  // ---------------------------------------------------------------------------
  const runWorkflowSimulation = (customTriggerName?: string) => {
    if (isSimulating) return;
    setIsSimulating(true);
    soundFx.playActionConfirm();

    const triggerLabel = customTriggerName || (executingAction ? executingAction.toUpperCase() : 'MANUAL TASK EXECUTION');
    const startTime = performance.now();

    const pipelineSteps = [
      {
        from: 'node-trigger',
        fromTitle: 'Executes Workflow',
        to: 'node-prompt',
        toTitle: 'Create User Prompt',
        status: 'DISPATCHED' as const,
        phase: 'trigger' as const,
        msg: `Dispatched [${triggerLabel}] input event into Prompt Engine`,
        badge: 'input.raw_event',
        model: 'OM-7 Event Gateway',
        delay: 150
      },
      {
        from: 'node-prompt',
        fromTitle: 'Create User Prompt',
        to: 'node-agent-ceo',
        toTitle: 'CEO Genesis Core',
        status: 'PROCESSING' as const,
        phase: 'prompt' as const,
        msg: `Synthesized vector prompt with 8k token context window`,
        badge: 'prompt_v2.json',
        model: 'Gemini 3.8 Flash',
        delay: 500
      },
      {
        from: 'node-prompt',
        fromTitle: 'Create User Prompt',
        to: 'node-agent-architect',
        toTitle: 'System Architect',
        status: 'PROCESSING' as const,
        phase: 'agent' as const,
        msg: `Dispatched parallel C4 architecture & Karpathy RAG query`,
        badge: 'c4_schema.json',
        model: 'Gemini 3.8 Flash',
        delay: 850
      },
      {
        from: 'node-agent-architect',
        fromTitle: 'System Architect',
        to: 'node-recall-rag',
        toTitle: 'Karpathy RAG Data Recall',
        status: 'TRANSITIONED' as const,
        phase: 'recall' as const,
        msg: `Memory recall active: querying wiki/ and raw/ vector vaults`,
        badge: 'rag.query_vector',
        model: 'Cosine Indexer',
        delay: 1200
      },
      {
        from: 'node-agent-ceo',
        fromTitle: 'CEO Genesis Core',
        to: 'node-parse-1',
        toTitle: 'Structured Output Parsed',
        status: 'TRANSITIONED' as const,
        phase: 'parser' as const,
        msg: `CEO emitted strategic directives; JSON structure verified`,
        badge: 'parse_ok: 100%',
        model: 'Schema Engine',
        delay: 1550
      },
      {
        from: 'node-recall-rag',
        fromTitle: 'Karpathy RAG Data Recall',
        to: 'node-processor-1',
        toTitle: 'Executive Synthesizer',
        status: 'TRANSITIONED' as const,
        phase: 'parser' as const,
        msg: `RAG memories (14 docs) merged with executive synthesis stream`,
        badge: 'context.merged',
        model: 'Vector Normalizer',
        delay: 1950
      },
      {
        from: 'node-processor-1',
        fromTitle: 'Executive Synthesizer',
        to: 'node-bundle',
        toTitle: 'Bundle Processed Data',
        status: 'TRANSITIONED' as const,
        phase: 'bundle' as const,
        msg: `Aggregating multi-agent deliverables into consensus bundle`,
        badge: 'bundle.sha256',
        model: 'Consensus Arbiter',
        delay: 2400
      },
      {
        from: 'node-bundle',
        fromTitle: 'Bundle Processed Data',
        to: 'node-success',
        toTitle: 'Success Status Generated',
        status: 'COMPLETED' as const,
        phase: 'success' as const,
        msg: `Workflow execution nominal: verified zero dead code`,
        badge: 'EXIT CODE 0',
        model: 'Bioluminescent Core',
        delay: 2850
      }
    ];

    pipelineSteps.forEach((step, index) => {
      setTimeout(() => {
        const currentElapsed = Math.round(performance.now() - startTime);
        setActiveTransition({ from: step.from, to: step.to });
        setActiveNodeId(step.to);

        const newLogEntry: WorkflowExecutionLogEntry = {
          id: `exec-${Date.now()}-${index}`,
          timestamp: formatPreciseTimestamp(new Date()),
          deltaMs: currentElapsed,
          sourceNodeId: step.from,
          sourceNodeTitle: step.fromTitle,
          targetNodeId: step.to,
          targetNodeTitle: step.toTitle,
          status: step.status,
          phaseCategory: step.phase,
          message: step.msg,
          payloadBadge: step.badge,
          modelBadge: step.model,
          latencyMs: Math.round(25 + Math.random() * 45)
        };

        setExecutionLogs(prev => [...prev, newLogEntry]);
        soundFx.playDataChirp();

        // Final completion cleanup
        if (index === pipelineSteps.length - 1) {
          setTimeout(() => {
            setActiveTransition(null);
            setActiveNodeId(null);
            setIsSimulating(false);
            soundFx.playAlert();
          }, 800);
        }
      }, step.delay);
    });
  };

  // Re-run simulation when executingAction prop arrives
  useEffect(() => {
    if (executingAction) {
      runWorkflowSimulation(executingAction);
    }
  }, [executingAction]);

  // Auto-scroll log to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && logListRef.current) {
      logListRef.current.scrollTop = logListRef.current.scrollHeight;
    }
  }, [executionLogs, isAutoScroll]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return executionLogs.filter(entry => {
      if (logFilter === 'TRANSITIONS' && entry.status !== 'TRANSITIONED' && entry.status !== 'DISPATCHED') return false;
      if (logFilter === 'AGENTS' && entry.phaseCategory !== 'agent') return false;
      if (logFilter === 'SUCCESS' && entry.status !== 'COMPLETED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = entry.message.toLowerCase().includes(q);
        const matchesSrc = entry.sourceNodeTitle?.toLowerCase().includes(q);
        const matchesTgt = entry.targetNodeTitle?.toLowerCase().includes(q);
        const matchesBadge = entry.payloadBadge?.toLowerCase().includes(q);
        if (!matchesMsg && !matchesSrc && !matchesTgt && !matchesBadge) return false;
      }
      return true;
    });
  }, [executionLogs, logFilter, searchQuery]);

  // Traveling Photons Particle Engine on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particleOffset = 0;

    const render = () => {
      const width = canvas.width = canvas.parentElement?.clientWidth || 1200;
      const height = canvas.height = canvas.parentElement?.clientHeight || 700;

      ctx.clearRect(0, 0, width, height);

      // Save transform
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Speed up particles when action is executing or simulating
      const speed = executingAction || isSimulating ? 0.025 : 0.007;
      particleOffset = (particleOffset + speed) % 1;

      // Draw all curved bezier conduits and traveling photons
      connections.forEach((conn, connIdx) => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return;

        const isConnActive = activeTransition && 
          activeTransition.from === conn.from && 
          activeTransition.to === conn.to;

        const startX = fromNode.x + fromNode.width;
        const startY = fromNode.y + fromNode.height / 2;
        const endX = toNode.x;
        const endY = toNode.y + toNode.height / 2;

        const deltaX = Math.abs(endX - startX) * 0.5;
        const cp1x = startX + Math.max(40, deltaX);
        const cp1y = startY;
        const cp2x = endX - Math.max(40, deltaX);
        const cp2y = endY;

        // 1. Draw Base Conduit Wire
        ctx.strokeStyle = isConnActive ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = isConnActive ? 3.5 : 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        ctx.stroke();

        // 2. Glowing Colored Accent Strand
        if (isConnActive) {
          ctx.strokeStyle = '#00F0FF';
          ctx.shadowBlur = 18;
          ctx.shadowColor = '#00F0FF';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = conn.color ? `${conn.color}40` : 'rgba(0, 240, 255, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // 3. Draw Traveling Photons along the Bezier Curve
        const photonCount = isConnActive ? 4 : 2;
        for (let p = 0; p < photonCount; p++) {
          const t = (particleOffset + (p / photonCount) + (connIdx * 0.15)) % 1;
          
          // Cubic Bezier interpolation: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
          const invT = 1 - t;
          const px = Math.pow(invT, 3) * startX +
                     3 * Math.pow(invT, 2) * t * cp1x +
                     3 * invT * Math.pow(t, 2) * cp2x +
                     Math.pow(t, 3) * endX;
          const py = Math.pow(invT, 3) * startY +
                     3 * Math.pow(invT, 2) * t * cp1y +
                     3 * invT * Math.pow(t, 2) * cp2y +
                     Math.pow(t, 3) * endY;

          // Photon Glow
          ctx.shadowBlur = isConnActive ? 22 : executingAction || isSimulating ? 14 : 8;
          ctx.shadowColor = isConnActive ? '#00F0FF' : conn.color || '#00F0FF';
          ctx.fillStyle = isConnActive ? '#E0F7FA' : '#FFFFFF';
          ctx.beginPath();
          ctx.arc(px, py, isConnActive ? 4.5 : executingAction || isSimulating ? 3.5 : 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Reset shadow
          ctx.shadowBlur = 0;
        }
      });

      // Draw Expanding Bioluminescent Ripple Aura on the Success Node
      const successNode = nodes.find(n => n.id === 'node-success');
      if (successNode) {
        const sX = successNode.x + successNode.width / 2;
        const sY = successNode.y + successNode.height / 2;

        const pulseTime = Date.now() * 0.002;
        const radius1 = 45 + Math.sin(pulseTime) * 12;
        const radius2 = 65 + Math.sin(pulseTime + 1.5) * 16;

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sX, sY, radius1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(sX, sY, radius2, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [pan, zoom, executingAction, isSimulating, activeTransition]);

  // Mouse pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking canvas background
    if ((e.target as HTMLElement).tagName === 'CANVAS' || (e.target as HTMLElement).id === 'workflow-bg') {
      isDraggingRef.current = true;
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setPan({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(z => Math.max(0.5, Math.min(1.8, z * zoomFactor)));
  };

  const handleNodeClick = (node: WorkflowNode) => {
    soundFx.playClick(1200);
    setSelectedNodeId(node.id);
    if (node.agentId) {
      onSelectAgent(node.agentId);
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div 
      ref={containerRef}
      id="workflow-bg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="relative w-full h-full bg-[#050811] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(16, 24, 40, 0.8) 0%, rgba(5, 8, 17, 1) 100%),
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 32px 32px, 32px 32px'
      }}
    >
      {/* HTML5 Canvas for Bezier Wires & Traveling Photons */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none z-0" 
      />

      {/* Floating Canvas Camera Controls (Top Left) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-[#0C121E]/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/[0.08] shadow-xl text-xs text-neutral-300">
        <span className="text-[10px] font-mono text-cyan-400 font-bold mr-1">
          CANVAS
        </span>
        <button
          onClick={() => {
            soundFx.playClick(1000);
            setZoom(z => Math.min(1.8, z + 0.15));
          }}
          className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white"
        >
          +
        </button>
        <span className="font-mono text-[11px] text-neutral-400 w-9 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => {
            soundFx.playClick(900);
            setZoom(z => Math.max(0.5, z - 0.15));
          }}
          className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white"
        >
          -
        </button>
        <button
          onClick={() => {
            soundFx.playClick(850);
            setPan({ x: 40, y: 30 });
            setZoom(0.92);
          }}
          title="Reset Camera"
          className="p-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 hover:text-white ml-1"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />

        {/* Toggle Pipeline Efficiency Chart */}
        <button
          onClick={() => {
            soundFx.playClick(1050);
            setShowEfficiencyChart(s => !s);
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
            showEfficiencyChart
              ? 'bg-[#ff8a1f]/20 text-[#ffb259] border border-[#ff8a1f]/35 font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Toggle Real-Time Pipeline Efficiency Line Chart"
        >
          <Activity className="w-3 h-3 text-[#ff8a1f]" />
          <span>EFFICIENCY</span>
        </button>
      </div>

      {/* Real-time Pipeline Efficiency Line Chart (Recharts overlay - Top Right) */}
      {showEfficiencyChart && (
        <div className="absolute top-4 right-4 z-20 pointer-events-auto">
          <PipelineEfficiencyChart
            agents={agents}
            executingAction={executingAction}
            isSimulating={isSimulating}
            thoughtLatencyMs={thoughtLatencyMs}
          />
        </div>
      )}

      {/* Node Cards Container (Positioned with Pan & Zoom transform) */}
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isNodeActive = activeNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const isTrigger = node.category === 'trigger';
          const isSuccess = node.category === 'success';
          const isAgent = node.category === 'agent';

          const targetAgentId = node.agentId || 'ceo';
          const assignedAgent = agents.find(a => a.id === targetAgentId) || agents[0];
          const thoughtMeta = NODE_AGENT_THOUGHTS[node.id] || {
            thought: `Executing active logic and compute cycles for ${node.title}.`,
            focus: node.subtitle || node.title
          };

          const isAbove = node.y >= 130;
          const thoughtMessage = (executingAction || isSimulating) && assignedAgent?.currentTask
            ? assignedAgent.currentTask
            : thoughtMeta.thought;

          return (
            <div
              key={node.id}
              onClick={() => handleNodeClick(node)}
              onMouseEnter={() => handleNodeMouseEnter(node.id)}
              onMouseLeave={handleNodeMouseLeave}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`
              }}
              className={`absolute pointer-events-auto rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all border ${
                isHovered
                  ? 'bg-[#182338] border-[#00F0FF] shadow-[0_0_24px_rgba(0,240,255,0.65)] scale-105 z-30'
                  : isNodeActive
                  ? 'bg-[#152336] border-[#00F0FF] shadow-[0_0_24px_rgba(0,240,255,0.7)] scale-105'
                  : isSelected
                  ? 'bg-[#151D2C] border-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.35)] scale-105'
                  : isTrigger
                  ? 'bg-gradient-to-br from-[#1E1710] to-[#121620] border-[#FFB300]/50 hover:border-[#FFB300] shadow-[0_0_15px_rgba(255,179,0,0.2)]'
                  : isSuccess
                  ? 'bg-gradient-to-br from-[#0F2228] to-[#0D1520] border-[#00F0FF]/60 hover:border-[#00F0FF] shadow-[0_0_25px_rgba(0,240,255,0.3)]'
                  : 'bg-[#0E1422]/90 hover:bg-[#131B2C] border-white/[0.08] hover:border-white/20'
              }`}
            >
              {/* Agent Thought Bubble Popup (triggers on hover) */}
              {isHovered && assignedAgent && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 pointer-events-none z-50 w-76 sm:w-80 select-none animate-in fade-in zoom-in-95 duration-200 ${
                    isAbove ? 'bottom-[calc(100%+14px)]' : 'top-[calc(100%+14px)]'
                  }`}
                >
                  {/* Comic Thought Bubble Tail (Diminishing Circles connecting node to bubble) */}
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none ${
                      isAbove ? 'top-full flex-col' : 'bottom-full flex-col-reverse'
                    }`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full bg-[#080d19] border shadow-md -my-0.5 z-20"
                      style={{ borderColor: `${assignedAgent.accentColor || '#ff8a1f'}80` }}
                    />
                    <div 
                      className="w-2 h-2 rounded-full bg-[#080d19] border shadow-sm my-0.5 z-10"
                      style={{ borderColor: `${assignedAgent.accentColor || '#ff8a1f'}60` }}
                    />
                    <div 
                      className="w-1.5 h-1.5 rounded-full my-0.5 animate-ping"
                      style={{ backgroundColor: assignedAgent.accentColor || '#ff8a1f' }}
                    />
                  </div>

                  {/* Main Thought Bubble Body */}
                  <div
                    className="relative rounded-2xl bg-[#080d19]/96 backdrop-blur-xl p-3 border shadow-[0_12px_36px_rgba(0,0,0,0.85)] font-mono text-xs"
                    style={{
                      borderColor: `${assignedAgent.accentColor || '#ff8a1f'}80`,
                      boxShadow: `0 12px 36px rgba(0,0,0,0.85), 0 0 22px ${assignedAgent.accentColor || '#ff8a1f'}40`
                    }}
                  >
                    {/* Header: Agent Identity & Load Status */}
                    <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/[0.08]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border shadow-sm"
                          style={{
                            backgroundColor: `${assignedAgent.accentColor || '#ff8a1f'}25`,
                            borderColor: assignedAgent.accentColor || '#ff8a1f'
                          }}
                        >
                          <Bot className="w-3.5 h-3.5" style={{ color: assignedAgent.accentColor || '#ff8a1f' }} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-condensed font-bold text-white text-xs truncate">
                              {assignedAgent.name}
                            </span>
                            <span 
                              className="px-1 py-0.2 rounded text-[8px] font-bold tracking-wider"
                              style={{ 
                                color: assignedAgent.accentColor || '#ff8a1f',
                                backgroundColor: `${assignedAgent.accentColor || '#ff8a1f'}20` 
                              }}
                            >
                              {assignedAgent.codename}
                            </span>
                          </div>
                          <div className="text-[9px] text-neutral-400 truncate">
                            {assignedAgent.role}
                          </div>
                        </div>
                      </div>

                      {/* Load / Status badge */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span 
                          className="w-1.5 h-1.5 rounded-full animate-ping"
                          style={{ backgroundColor: assignedAgent.accentColor || '#ff8a1f' }}
                        />
                        <span 
                          className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                          style={{ 
                            color: assignedAgent.accentColor || '#ff8a1f',
                            backgroundColor: `${assignedAgent.accentColor || '#ff8a1f'}18` 
                          }}
                        >
                          {assignedAgent.loadPercent}% LOAD
                        </span>
                      </div>
                    </div>

                    {/* Active Agent Reasoning Thought Body */}
                    <div className="relative pl-3 pr-1 py-1 mb-2 border-l-2" style={{ borderColor: assignedAgent.accentColor || '#ff8a1f' }}>
                      <div className="text-[9.5px] uppercase tracking-wider text-neutral-400 mb-0.5 flex items-center gap-1">
                        <Brain className="w-3 h-3 text-cyan-300 animate-pulse" />
                        <span>PROCESSING AGENT THOUGHT:</span>
                      </div>
                      <p className="text-[11px] text-white italic font-sans leading-relaxed">
                        "{thoughtMessage}"
                      </p>
                    </div>

                    {/* Footer: Node Logic & Latency */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.06] text-[8.5px] text-neutral-400">
                      <div className="truncate mr-2">
                        <span className="text-neutral-500">STAGE LOGIC: </span>
                        <span className="text-neutral-200 font-semibold">{thoughtMeta.focus}</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1 font-mono">
                        <span className="text-neutral-500">THOUGHT:</span>
                        <span className="text-cyan-300 font-bold">{thoughtLatencyMs ? (thoughtLatencyMs * 0.05).toFixed(1) : '18.4'}ms</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Node Top Row: Icon + Title */}
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isTrigger ? 'bg-amber-500/20 text-[#FFB300]' :
                  isSuccess ? 'bg-cyan-500/20 text-[#00F0FF]' :
                  isAgent ? 'bg-indigo-500/20 text-indigo-300' :
                  'bg-white/[0.08] text-white'
                }`}>
                  {node.icon === 'zap' && <Zap className="w-3.5 h-3.5" />}
                  {node.icon === 'edit' && <Edit3 className="w-3.5 h-3.5" />}
                  {node.icon === 'bot' && <Bot className="w-3.5 h-3.5" />}
                  {node.icon === 'database' && <Database className="w-3.5 h-3.5" />}
                  {node.icon === 'code' && <Activity className="w-3.5 h-3.5" />}
                  {node.icon === 'bundle' && <Share2 className="w-3.5 h-3.5 text-cyan-300" />}
                  {node.icon === 'check' && <CheckCircle2 className="w-4 h-4 text-[#00F0FF]" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-white tracking-tight truncate">
                    {node.title}
                  </div>
                  {node.subtitle && (
                    <div className="text-[10px] text-neutral-400 truncate font-mono">
                      {node.subtitle}
                    </div>
                  )}
                </div>
              </div>

              {/* Node Bottom Row: Tags & Status indicators */}
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] text-[9px] font-mono">
                {node.modelTag ? (
                  <span className="text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-500/20">
                    {node.modelTag}
                  </span>
                ) : (
                  <span className="text-neutral-500 uppercase">
                    {node.category}
                  </span>
                )}

                <span className={`flex items-center gap-1 ${
                  isSuccess ? 'text-emerald-400 font-bold' :
                  isTrigger ? 'text-amber-400' :
                  isNodeActive ? 'text-cyan-300 font-bold animate-pulse' :
                  'text-neutral-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isSuccess ? 'bg-emerald-400 animate-ping' :
                    isTrigger ? 'bg-amber-400' :
                    isNodeActive ? 'bg-cyan-400 animate-ping' :
                    'bg-cyan-400'
                  }`} />
                  {isNodeActive ? 'ACTIVE' : node.status.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Node Details Drawer (Bottom Left Floating) */}
      {selectedNode && (
        <div className="absolute bottom-16 left-4 z-20 w-80 bg-[#0B101C]/95 backdrop-blur-xl border border-white/[0.12] rounded-xl p-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{selectedNode.title}</span>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-neutral-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>

          <div className="mt-2 space-y-1.5 text-xs text-neutral-300">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-neutral-500">Pipeline Stage:</span>
              <span className="text-cyan-300 uppercase">{selectedNode.category}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-neutral-500">Telemetry Status:</span>
              <span className="text-emerald-400">{selectedNode.status.toUpperCase()}</span>
            </div>
            {selectedNode.modelTag && (
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-neutral-500">Assigned Model:</span>
                <span className="text-amber-300">{selectedNode.modelTag}</span>
              </div>
            )}
            <p className="text-[11px] text-neutral-400 pt-1 leading-relaxed">
              Active node in the OpenMausBot execution pipeline. Conduits transmit data with sub-2ms multi-agent cognitive handoff.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REAL-TIME WORKFLOW EXECUTION LOG OVERLAY (Event Timestamps & Transitions) */}
      {/* ========================================================================= */}
      {!isLogOpen ? (
        /* Collapsed Minimalist HUD Pill (Bottom Right) */
        <div className="absolute bottom-2.5 right-2.5 z-30 flex items-center gap-2 bg-[#0C121E]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#ff8a1f]/40 shadow-2xl text-xs">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-[#ff8a1f]" />
            <span className="font-condensed font-bold tracking-wider text-white text-[11px]">
              WORKFLOW EXECUTION LOG
            </span>
            <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          </div>

          <span className="font-mono text-[10px] text-neutral-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
            {executionLogs.length} EVENTS
          </span>

          {activeTransition && (
            <span className="font-mono text-[10px] text-cyan-300 animate-pulse bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
              {activeTransition.from} → {activeTransition.to}
            </span>
          )}

          <button
            onClick={() => runWorkflowSimulation()}
            disabled={isSimulating}
            className="px-2 py-0.5 rounded bg-[#ff8a1f] hover:bg-[#ffb259] text-[#120802] font-condensed font-bold text-[10px] flex items-center gap-1 transition-all disabled:opacity-50"
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            <span>{isSimulating ? 'SIMULATING...' : 'SIMULATE'}</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick(1100);
              setIsLogOpen(true);
            }}
            className="px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white font-mono text-[10px] flex items-center gap-1"
          >
            <Maximize2 className="w-2.5 h-2.5" />
            <span>EXPAND</span>
          </button>
        </div>
      ) : (
        /* Docked Interactive Telemetry Overlay (Bottom Right) */
        <div 
          className={`absolute bottom-2.5 right-2.5 z-30 flex flex-col bg-[#0A0F1A]/95 backdrop-blur-xl border border-[#ff8a1f]/35 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.85)] transition-all overflow-hidden ${
            logViewMode === 'expanded' ? 'w-[520px] max-w-[95%] h-[320px]' : 'w-[430px] max-w-[92%] h-[215px]'
          }`}
        >
          {/* Overlay Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#070B13] border-b border-[#ff8a1f]/20">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#ff8a1f]" />
              <span className="font-condensed font-bold tracking-wider text-white text-xs uppercase">
                WORKFLOW EXECUTION LOG
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </span>
              <span className="font-mono text-[10px] text-neutral-400">
                ({filteredLogs.length})
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs">
              {/* Trigger Simulation Button */}
              <button
                onClick={() => runWorkflowSimulation()}
                disabled={isSimulating}
                title="Trigger simulated task flow"
                className="px-2 py-0.5 rounded bg-[#ff8a1f] hover:bg-[#ffb259] text-[#120802] font-condensed font-bold text-[10px] flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>{isSimulating ? 'SIMULATING...' : 'SIMULATE'}</span>
              </button>

              {/* Auto Scroll Toggle */}
              <button
                onClick={() => setIsAutoScroll(!isAutoScroll)}
                title={`Auto-scroll: ${isAutoScroll ? 'ON' : 'OFF'}`}
                className={`p-1 rounded text-[10px] font-mono transition-colors ${
                  isAutoScroll ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-neutral-500 hover:text-white'
                }`}
              >
                <Clock className="w-3 h-3" />
              </button>

              {/* Clear Logs */}
              <button
                onClick={() => {
                  soundFx.playClick(800);
                  setExecutionLogs([]);
                }}
                title="Clear Log History"
                className="p-1 rounded text-neutral-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>

              {/* View Mode Toggle */}
              <button
                onClick={() => setLogViewMode(m => m === 'compact' ? 'expanded' : 'compact')}
                title={logViewMode === 'compact' ? 'Expand height' : 'Compact view'}
                className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
              >
                {logViewMode === 'compact' ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              </button>

              {/* Minimize / Collapse */}
              <button
                onClick={() => {
                  soundFx.playClick(900);
                  setIsLogOpen(false);
                }}
                title="Minimize Overlay"
                className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex items-center justify-between px-2.5 py-1 bg-[#090D18] border-b border-white/[0.06] text-[10px] font-mono">
            <div className="flex items-center gap-1">
              {(['ALL', 'TRANSITIONS', 'AGENTS', 'SUCCESS'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => {
                    soundFx.playClick(1050);
                    setLogFilter(f);
                  }}
                  className={`px-1.5 py-0.5 rounded uppercase font-semibold transition-colors ${
                    logFilter === f 
                      ? 'bg-[#ff8a1f]/20 text-[#ffb259] border border-[#ff8a1f]/40' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[#060A12] px-2 py-0.5 rounded border border-white/[0.06] w-32">
              <Search className="w-2.5 h-2.5 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter logs..."
                className="w-full bg-transparent text-[10px] text-white focus:outline-none placeholder-neutral-600 font-mono"
              />
            </div>
          </div>

          {/* Real-time Log Stream List */}
          <div 
            ref={logListRef}
            className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-1.5 scrollbar-thin scrollbar-thumb-neutral-700"
          >
            {filteredLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-neutral-500 text-[11px] font-mono">
                No execution events recorded. Click SIMULATE to trigger task flow.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isHighlight = activeTransition && 
                  activeTransition.from === log.sourceNodeId && 
                  activeTransition.to === log.targetNodeId;

                return (
                  <div
                    key={log.id}
                    onClick={() => focusNode(log.targetNodeId || log.sourceNodeId)}
                    title="Click to focus node on canvas"
                    className={`group p-1.5 rounded-lg border transition-all cursor-pointer ${
                      isHighlight
                        ? 'bg-[#00f0ff]/10 border-[#00f0ff]/60 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                        : 'bg-[#0c121e]/80 hover:bg-[#111928] border-white/[0.05] hover:border-[#ff8a1f]/40'
                    }`}
                  >
                    {/* Row 1: Timestamp + Status + Node Transition Route */}
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono leading-none">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 font-semibold">
                          [{log.timestamp}]
                        </span>
                        <span className="text-neutral-500 text-[9px]">
                          +{log.deltaMs}ms
                        </span>
                      </div>

                      {/* Status Tag */}
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                        log.status === 'COMPLETED' ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30' :
                        log.status === 'TRANSITIONED' ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/30' :
                        log.status === 'PROCESSING' ? 'bg-purple-950/70 text-purple-300 border border-purple-500/30' :
                        log.status === 'DISPATCHED' ? 'bg-amber-950/70 text-amber-300 border border-amber-500/30' :
                        'bg-neutral-800 text-neutral-300'
                      }`}>
                        {log.status}
                      </span>
                    </div>

                    {/* Row 2: Node Transition Route with Arrow */}
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-condensed tracking-wide">
                      <span className="text-neutral-400 group-hover:text-white transition-colors truncate max-w-[120px]">
                        {log.sourceNodeTitle || log.sourceNodeId}
                      </span>
                      <ArrowRight className="w-3 h-3 text-[#ff8a1f] shrink-0" />
                      <span className="text-cyan-300 font-semibold group-hover:text-cyan-200 transition-colors truncate max-w-[130px]">
                        {log.targetNodeTitle || log.targetNodeId}
                      </span>
                    </div>

                    {/* Row 3: Event Message & Badges */}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-tight text-neutral-300 font-barlow">
                      <span className="truncate flex-1">
                        {log.message}
                      </span>

                      <div className="flex items-center gap-1 shrink-0 font-mono text-[9px]">
                        {log.modelBadge && (
                          <span className="text-[#ffb259] bg-[#ff8a1f]/10 px-1 py-0.2 rounded border border-[#ff8a1f]/20">
                            {log.modelBadge}
                          </span>
                        )}
                        {log.payloadBadge && (
                          <span className="text-cyan-400 bg-cyan-950/50 px-1 py-0.2 rounded border border-cyan-500/20">
                            {log.payloadBadge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Status Bar with Node Transition Ticker */}
          <div className="flex items-center justify-between px-3 py-1 bg-[#070B13] border-t border-white/[0.06] text-[9px] font-mono text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">
                {activeTransition ? '● TRANSITIONING' : '● NOMINAL'}
              </span>
              {activeTransition ? (
                <span className="text-cyan-300 font-bold animate-pulse">
                  {activeTransition.from} ➔ {activeTransition.to}
                </span>
              ) : (
                <span>Ready • Sub-2ms Multi-Agent Handshake</span>
              )}
            </div>
            <span className="text-[#ffb259]">
              7/7 NODES SYNCED
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
