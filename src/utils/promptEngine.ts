// Enhanced prompt engineering for different ticket types
export type TicketType = 'bug' | 'feature' | 'epic' | 'task' | 'improvement';

export interface PromptContext {
  ticketType: TicketType;
  keywords: string[];
  urgency: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'medium' | 'complex';
}

// Keywords for different ticket types
const TICKET_TYPE_KEYWORDS = {
  bug: [
    'bug', 'error', 'crash', 'broken', 'fix', 'issue', 'problem', 'fault',
    'not working', 'failing', 'exception', 'unexpected', 'wrong', 'incorrect'
  ],
  feature: [
    'feature', 'add', 'new', 'create', 'implement', 'build', 'develop',
    'functionality', 'ability', 'support', 'allow', 'enable', 'want', 'need'
  ],
  epic: [
    'epic', 'large', 'big', 'major', 'overhaul', 'redesign', 'refactor',
    'architecture', 'system', 'platform', 'infrastructure', 'migration'
  ],
  improvement: [
    'improve', 'optimize', 'enhance', 'better', 'faster', 'performance',
    'efficiency', 'upgrade', 'update', 'refine', 'polish'
  ],
  task: [
    'task', 'setup', 'configure', 'install', 'deploy', 'documentation',
    'research', 'investigate', 'analysis', 'planning', 'maintenance'
  ]
};

// Urgency keywords
const URGENCY_KEYWORDS = {
  high: ['urgent', 'critical', 'immediately', 'asap', 'blocking', 'broken', 'down', 'crash'],
  medium: ['important', 'soon', 'needed', 'priority', 'should'],
  low: ['eventually', 'nice to have', 'when possible', 'low priority', 'future']
};

// Complexity keywords  
const COMPLEXITY_KEYWORDS = {
  complex: ['complex', 'complicated', 'multiple', 'integration', 'system', 'architecture', 'migration', 'refactor'],
  medium: ['several', 'some', 'various', 'different', 'couple'],
  simple: ['simple', 'quick', 'small', 'minor', 'basic', 'easy', 'straightforward']
};

export function analyzeInput(input: string): PromptContext {
  const lowerInput = input.toLowerCase();
  const words = lowerInput.split(/\s+/);
  
  // Detect ticket type
  let ticketType: TicketType = 'task'; // default
  let maxMatches = 0;
  
  for (const [type, keywords] of Object.entries(TICKET_TYPE_KEYWORDS)) {
    const matches = keywords.filter(keyword => lowerInput.includes(keyword)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      ticketType = type as TicketType;
    }
  }
  
  // Detect urgency
  let urgency: 'low' | 'medium' | 'high' = 'medium'; // default
  for (const [level, keywords] of Object.entries(URGENCY_KEYWORDS)) {
    if (keywords.some(keyword => lowerInput.includes(keyword))) {
      urgency = level as 'low' | 'medium' | 'high';
      break;
    }
  }
  
  // Detect complexity
  let complexity: 'simple' | 'medium' | 'complex' = 'medium'; // default
  for (const [level, keywords] of Object.entries(COMPLEXITY_KEYWORDS)) {
    if (keywords.some(keyword => lowerInput.includes(keyword))) {
      complexity = level as 'simple' | 'medium' | 'complex';
      break;
    }
  }
  
  // Extract key keywords
  const allKeywords = Object.values(TICKET_TYPE_KEYWORDS).flat();
  const foundKeywords = words.filter(word => allKeywords.includes(word));
  
  return {
    ticketType,
    keywords: foundKeywords,
    urgency,
    complexity
  };
}

export function buildEnhancedPrompt(input: string, context: PromptContext): string {
  const basePrompt = `Transform the following user requirements into a professional, well-structured ${context.ticketType} ticket for a development team:

USER INPUT:
"${input}"

DETECTED CONTEXT:
- Type: ${context.ticketType.toUpperCase()}
- Urgency: ${context.urgency.toUpperCase()}
- Complexity: ${context.complexity.toUpperCase()}
${context.keywords.length > 0 ? `- Key terms: ${context.keywords.join(', ')}` : ''}

`;

  const typeSpecificInstructions = getTypeSpecificInstructions(context.ticketType, context.urgency, context.complexity);
  
  const formatInstructions = `
Please create a comprehensive ticket with the following structure:
- A clear, descriptive title with appropriate emoji
- Summary section explaining the request
- Detailed acceptance criteria (as checkboxes)
- Technical considerations if relevant
- Priority level and appropriate labels
- Definition of done
- ${context.complexity === 'complex' ? 'Breaking down into subtasks if needed' : ''}

Use professional but friendly tone with markdown formatting. The ticket should be ready to copy-paste into Jira, GitLab, or similar platforms.

Make it something a product manager or tech lead would confidently submit to their development team.`;

  return basePrompt + typeSpecificInstructions + formatInstructions;
}

function getTypeSpecificInstructions(type: TicketType, urgency: string, complexity: string): string {
  const instructions = {
    bug: `
Focus on:
- Clear reproduction steps
- Expected vs actual behavior
- Impact assessment and affected users
- Environment details
- Screenshots or logs if applicable
- Root cause analysis suggestions
${urgency === 'high' ? '- Immediate mitigation steps\n- Rollback plan if needed' : ''}
`,
    feature: `
Focus on:
- User story format ("As a... I want... So that...")
- Business value and user impact
- User flow and experience considerations
- Edge cases and error scenarios
- Integration points with existing features
${complexity === 'complex' ? '- Breaking into smaller deliverable chunks' : ''}
`,
    epic: `
Focus on:
- High-level business objectives
- Multiple user stories or components involved
- Timeline and milestone breakdown
- Dependencies and risks
- Success metrics and KPIs
- Stakeholder impact analysis
`,
    improvement: `
Focus on:
- Current state vs desired state
- Performance metrics and targets
- User experience impact
- Technical debt considerations
- Backward compatibility
- Measurement criteria for success
`,
    task: `
Focus on:
- Clear deliverables and outcomes
- Step-by-step approach
- Required resources and tools
- Dependencies and prerequisites
- Documentation requirements
- Verification criteria
`
  };

  return instructions[type] || instructions.task;
}