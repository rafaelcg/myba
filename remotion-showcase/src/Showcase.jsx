import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const palette = {
  pageTop: '#101739',
  pageBottom: '#2a1244',
  frameBorder: 'rgba(255,255,255,0.16)',
  glass: 'rgba(26, 21, 44, 0.72)',
  boardBg: 'rgba(22, 16, 42, 0.76)',
  cardBg: 'linear-gradient(165deg, rgba(70, 59, 94, 0.92) 0%, rgba(56, 43, 77, 0.9) 100%)',
  cardBorder: 'rgba(255,255,255,0.15)',
  textPrimary: '#f6efff',
  textSecondary: 'rgba(245,234,255,0.72)',
  gold: '#ffd166',
  purple: '#925cff',
  cyan: '#5fceff',
  green: '#72e8a1',
  red: '#ff8585',
};

const boardData = [
  {
    name: 'BACKLOG',
    count: 3,
    tickets: [
      {
        priority: 'HIGH',
        version: 'v2.2',
        title: 'Add dark mode toggle for dashboard analytics',
        owner: '🦊 #4',
        ownerColor: '#f3a34e',
        avatarName: 'RG',
      },
      {
        priority: 'HIGH',
        version: 'v2.1',
        title: 'Implement real-time collaboration cursors',
        owner: '🦊 #3',
        ownerColor: '#f3a34e',
        avatarName: 'SG',
      },
      {
        priority: 'LOW',
        version: 'v1.9',
        title: 'Export tickets to PDF with custom templates',
        owner: '🦊 #1',
        ownerColor: '#f3a34e',
        avatarName: 'LM',
      },
    ],
  },
  {
    name: 'IN PROGRESS',
    count: 2,
    tickets: [
      {
        priority: 'HIGH',
        version: 'v2.2',
        title: 'Implement initial test case for product validation',
        owner: '🦊 #4',
        ownerColor: '#f3a34e',
        avatarName: 'JL',
      },
      {
        priority: 'LOW',
        version: 'v2.3',
        title: 'Integrate new payment gateway endpoints in checkout flow',
        owner: '🦊 #2',
        ownerColor: '#f3a34e',
        avatarName: 'AT',
      },
    ],
  },
  {
    name: 'REVIEW',
    count: 2,
    tickets: [
      {
        priority: 'HIGH',
        version: 'v2.0',
        title: 'Redesign onboarding flow with progressive disclosure',
        owner: '🦊 #6',
        ownerColor: '#f3a34e',
        avatarName: 'KP',
      },
      {
        priority: 'LOW',
        version: 'v2.4',
        title: 'Add keyboard shortcuts for power users',
        owner: '🦊 #5',
        ownerColor: '#f3a34e',
        avatarName: 'MB',
      },
    ],
  },
  {
    name: 'DONE',
    count: 3,
    tickets: [
      {
        priority: 'HIGH',
        version: 'v2.1',
        title: 'Integrate with GitLab Issues API for direct sprint sync',
        owner: '🦊 #7',
        ownerColor: '#f3a34e',
        avatarName: 'CR',
      },
      {
        priority: 'LOW',
        version: 'v1.8',
        title: 'Update documentation with new API endpoints',
        owner: '🦊 #2',
        ownerColor: '#f3a34e',
        avatarName: 'AV',
      },
      {
        priority: 'HIGH',
        version: 'v2.5',
        title: 'Fix mobile layout issues on iOS Safari',
        owner: '🦊 #8',
        ownerColor: '#f3a34e',
        avatarName: 'NR',
      },
    ],
  },
];

const priorityStyles = {
  HIGH: {
    border: '1.6px solid rgba(255,99,99,0.8)',
    background: 'rgba(255,99,99,0.14)',
    color: '#ff9a9a',
  },
  LOW: {
    border: '1.6px solid rgba(72,214,127,0.9)',
    background: 'rgba(72,214,127,0.14)',
    color: '#8af4b5',
  },
};

const Avatar = ({name}) => (
  <div
    style={{
      width: 34,
      height: 34,
      borderRadius: 999,
      display: 'grid',
      placeItems: 'center',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.02,
      color: '#f7f2ff',
      border: '1px solid rgba(255,255,255,0.45)',
      background:
        'radial-gradient(circle at 26% 24%, rgba(255,255,255,0.45), transparent 34%), linear-gradient(135deg, #4f6fff, #9c5cff 54%, #ff8f7a)',
      textTransform: 'uppercase',
    }}
  >
    {name}
  </div>
);

const TicketCard = ({ticket, selected = false}) => {
  return (
    <div
      style={{
        background: palette.cardBg,
        border: `1px solid ${selected ? 'rgba(146,92,255,0.45)' : palette.cardBorder}`,
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        boxShadow: selected ? '0 10px 34px rgba(146,92,255,0.28)' : 'none',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
        <div
          style={{
            ...priorityStyles[ticket.priority],
            borderRadius: 999,
            padding: '4px 11px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.04,
          }}
        >
          {ticket.priority}
        </div>
        <div
          style={{
            border: '1.2px solid rgba(255,255,255,0.24)',
            color: 'rgba(255,255,255,0.75)',
            borderRadius: 999,
            padding: '4px 11px',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {ticket.version}
        </div>
      </div>
      <div style={{fontSize: 15, lineHeight: 1.36, color: palette.textPrimary, fontWeight: 500}}>{ticket.title}</div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12}}>
        <div
          style={{
            border: '1.2px solid rgba(244,157,58,0.54)',
            background: 'rgba(244,157,58,0.15)',
            color: ticket.ownerColor,
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {ticket.owner}
        </div>
        <Avatar name={ticket.avatarName} />
      </div>
    </div>
  );
};

const Board = ({frame}) => {
  const boardIn = spring({frame, fps: 30, config: {damping: 26, stiffness: 170}});
  const slowZoom = interpolate(frame, [0, 620], [1.02, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  const spotlightProgress = interpolate(frame, [160, 260], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const zoomToAdd = interpolate(frame, [60, 150], [1, 1.42], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const zoomLift = interpolate(frame, [60, 150], [0, -18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const addClickPulse = interpolate(frame, [132, 140, 150], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 1520,
        height: 860,
        borderRadius: 28,
        border: `1px solid ${palette.frameBorder}`,
        background: palette.boardBg,
        boxShadow: '0 25px 100px rgba(0,0,0,0.46)',
        overflow: 'hidden',
        transform: `translateY(${(1 - boardIn) * 36 + zoomLift}px) scale(${(0.98 + boardIn * 0.02) * slowZoom * zoomToAdd})`,
        transformOrigin: '39% 84%',
        opacity: boardIn,
      }}
    >
      <div
        style={{
          height: 74,
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 26px',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              fontSize: 16,
              background: 'linear-gradient(135deg, #1ca5ff, #4bd3ff)',
              boxShadow: '0 4px 18px rgba(76,200,255,0.35)',
            }}
          >
            📋
          </div>
          <div style={{fontSize: 35, fontWeight: 700, color: palette.textPrimary}}>Your Board View</div>
        </div>
        <div style={{fontSize: 27, color: palette.textSecondary}}>Filter • Sort • + New Ticket</div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, padding: 18}}>
        {boardData.map((column, columnIndex) => {
          const isSpotlightColumn = column.name === 'IN PROGRESS';
          const isAddFocusColumn = column.name === 'IN PROGRESS';
          const columnOpacity = isSpotlightColumn ? 1 : 1 - spotlightProgress * 0.2;

          return (
            <div
              key={column.name}
              style={{
                borderRadius: 16,
                background: 'rgba(255,255,255,0.03)',
                padding: 14,
                position: 'relative',
                opacity: columnOpacity,
                transform: `scale(${isSpotlightColumn ? 1 + spotlightProgress * 0.012 : 1})`,
                border: `1px solid ${isSpotlightColumn ? `rgba(146,92,255,${0.1 + spotlightProgress * 0.34})` : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.86)', letterSpacing: 0.04}}>{column.name}</div>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.9)',
                    background: 'rgba(255,255,255,0.1)',
                  }}
                >
                  {column.count}
                </div>
              </div>

              <div style={{height: 1, background: 'rgba(255,255,255,0.17)', margin: '12px 0'}} />

              {column.tickets.map((ticket, ticketIndex) => {
                const isSelected = isSpotlightColumn && ticketIndex === 0;
                return <TicketCard key={`${column.name}-${ticket.title}`} ticket={ticket} selected={isSelected} />;
              })}

              <div
                style={{
                  marginTop: 8,
                  borderRadius: 12,
                  border: `1px dashed ${isAddFocusColumn ? `rgba(255, 209, 102, ${0.22 + addClickPulse * 0.58})` : 'rgba(255,255,255,0.22)'}`,
                  color: isAddFocusColumn ? '#e9d6ff' : 'rgba(255,255,255,0.6)',
                  height: 44,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 16,
                  transform: `scale(${isAddFocusColumn ? 1 - addClickPulse * 0.035 : 1})`,
                  boxShadow: isAddFocusColumn ? `0 0 0 ${addClickPulse * 8}px rgba(255, 209, 102, 0.14)` : 'none',
                }}
              >
                + Add Ticket
              </div>

              {isAddFocusColumn ? (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: 34,
                    width: 14 + addClickPulse * 70,
                    height: 14 + addClickPulse * 70,
                    borderRadius: 999,
                    border: `1px solid rgba(255, 209, 102, ${0.6 - addClickPulse * 0.45})`,
                    transform: 'translateX(-50%)',
                    opacity: addClickPulse * 0.75,
                    pointerEvents: 'none',
                  }}
                />
              ) : null}

              {isSpotlightColumn ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 16,
                    border: `1px solid rgba(146,92,255,${spotlightProgress * 0.45})`,
                    boxShadow: `0 0 0 ${spotlightProgress * 8}px rgba(146,92,255,0.07)`,
                    pointerEvents: 'none',
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const QuickCreate = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const entrance = spring({frame, fps, config: {damping: 24, stiffness: 180}});
  const chars = Math.floor(interpolate(frame, [12, 90], [0, 47], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const prompt = 'Create an AI chatbot using GPT-5.3 with auth + history';
  const typed = prompt.slice(0, chars);
  const showDraft = frame >= 76;
  const clickPulse = interpolate(frame, [120, 130, 142], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          width: 1160,
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(21, 14, 35, 0.94)',
          boxShadow: '0 28px 110px rgba(0,0,0,0.55)',
          padding: 30,
          transform: `translateY(${(1 - entrance) * 36}px) scale(${0.98 + entrance * 0.02})`,
          opacity: entrance,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{fontSize: 40, fontWeight: 700, color: '#f2ebff'}}>✨ Quick Create</div>
          <div style={{fontSize: 25, color: 'rgba(255,255,255,0.5)'}}>ESC to close</div>
        </div>

        <div
          style={{
            marginTop: 18,
            borderRadius: 20,
            border: '2px solid #3298ff',
            minHeight: 170,
            background: '#2d2540',
            padding: '24px 22px',
            color: 'rgba(255,255,255,0.93)',
            fontSize: 42,
            lineHeight: 1.2,
          }}
        >
          {typed}
          <span style={{opacity: frame % 22 < 11 ? 0.95 : 0.25}}>|</span>
        </div>

        <div
          style={{
            marginTop: 16,
            borderRadius: 16,
            border: '1px dashed rgba(169,120,255,0.65)',
            background: '#3b2950',
            padding: '16px 18px',
            opacity: showDraft ? 1 : 0,
            transform: `translateY(${showDraft ? 0 : 12}px)`,
          }}
        >
          <div style={{fontSize: 26, color: '#d4b8ff', fontWeight: 700}}>✨ AI Generated Title</div>
          <div style={{fontSize: 43, color: '#e2d2ff', lineHeight: 1.2, marginTop: 8, fontWeight: 600}}>
            Implement AI Chatbot with GPT-5.3 for Enhanced User Interaction
          </div>
        </div>

        <div style={{display: 'flex', gap: 18, marginTop: 18}}>
          <div
            style={{
              flex: 1,
              height: 78,
              borderRadius: 18,
              background: '#57505f',
              color: 'rgba(255,255,255,0.64)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 42,
              fontWeight: 500,
            }}
          >
            Cancel
          </div>
          <div
            style={{
              flex: 1,
              height: 78,
              borderRadius: 18,
              background: `linear-gradient(135deg, #9c62ff, #6e55ff)`,
              color: '#f8f2ff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 42,
              fontWeight: 700,
              transform: `scale(${1 - clickPulse * 0.03})`,
              boxShadow: `0 10px 34px rgba(130,84,255,${0.25 + clickPulse * 0.25})`,
            }}
          >
            Create Ticket
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const GitLabSyncPanel = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const show = spring({frame, fps, config: {damping: 23, stiffness: 160}});
  const progress = interpolate(frame, [0, 80], [8, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          width: 980,
          borderRadius: 22,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(21,15,35,0.94)',
          boxShadow: '0 24px 90px rgba(0,0,0,0.5)',
          padding: 26,
          transform: `translateY(${(1 - show) * 18}px) scale(${0.98 + show * 0.02})`,
          opacity: show,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{fontSize: 34, color: palette.textPrimary, fontWeight: 700}}>Syncing to GitLab</div>
          <div style={{fontSize: 28, color: palette.gold, fontWeight: 700}}>{Math.round(progress)}%</div>
        </div>
        <div
          style={{
            height: 12,
            marginTop: 14,
            borderRadius: 999,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.13)',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #8f5dff, #58ccff)',
              boxShadow: '0 0 20px rgba(92,183,255,0.4)',
            }}
          />
        </div>
        <div style={{marginTop: 12, fontSize: 24, color: 'rgba(255,255,255,0.8)'}}>
          Creating issue in GitLab with title, acceptance criteria, and labels...
        </div>
      </div>
    </AbsoluteFill>
  );
};

const GitLabIssuePreview = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const inSpring = spring({frame, fps, config: {damping: 24, stiffness: 160}});
  const revealBottom = interpolate(frame, [0, 16], [62, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const scrollY = interpolate(frame, [24, 56], [0, -470], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const fadeOut = interpolate(frame, [72, 96], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const opacity = inSpring * fadeOut;

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity}}>
      <div
        style={{
          width: 1150,
          height: 700,
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.18)',
          background: '#f4f3f6',
          boxShadow: '0 24px 100px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          clipPath: `inset(0 0 ${revealBottom}% 0 round 20px)`,
        }}
      >
        <div style={{height: 700, overflow: 'hidden', position: 'relative'}}>
          <div style={{transform: `translateY(${scrollY}px)`, padding: '26px 30px 80px', color: '#181822'}}>
            <div style={{fontSize: 62, fontWeight: 800, lineHeight: 1.08}}>
              Implement AI Chatbot with GPT-5.3 for Enhanced User Interaction
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, fontSize: 20, color: '#474759'}}>
              <span
                style={{
                  borderRadius: 999,
                  background: '#d7f1df',
                  color: '#1a7b40',
                  padding: '2px 12px',
                  fontWeight: 700,
                }}
              >
                Open
              </span>
              <span>Issue created now by My BA</span>
            </div>

            <div style={{fontSize: 54, fontWeight: 800, marginTop: 24}}>🤖 Implement AI-Powered Conversational Chatbot Feature</div>

            <Section title="User Story">
              As a user, I want an intelligent AI chatbot integrated into our platform so that I can receive instant,
              contextual support and enhance my overall user experience.
            </Section>

            <Section title="Summary">
              Develop a sophisticated AI chatbot powered by advanced language model technology to provide responsive,
              intelligent conversational support across our platform.
            </Section>

            <Section title="Business Value">
              <ul style={{margin: 0, paddingLeft: 30, lineHeight: 1.5}}>
                <li>Reduce customer support response times</li>
                <li>Provide 24/7 automated customer assistance</li>
                <li>Decrease support team workload</li>
                <li>Improve overall user engagement and satisfaction</li>
              </ul>
            </Section>

            <Section title="Acceptance Criteria">
              <ul style={{margin: 0, paddingLeft: 30, lineHeight: 1.5}}>
                <li>Implement GPT-5.3 provider integration</li>
                <li>Support multi-turn conversational context</li>
                <li>Add robust error handling and fallback responses</li>
                <li>Track usage and conversation quality analytics</li>
              </ul>
            </Section>

            <Section title="Technical Considerations">
              <ul style={{margin: 0, paddingLeft: 30, lineHeight: 1.5}}>
                <li>Secure token management and API key rotation</li>
                <li>Rate limiting and abuse safeguards</li>
                <li>Conversation state retention architecture</li>
                <li>Performance tuning for response generation</li>
              </ul>
            </Section>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Section = ({title, children}) => (
  <div style={{marginTop: 24}}>
    <div style={{fontSize: 52, fontWeight: 800, marginBottom: 8}}>{title}</div>
    <div style={{fontSize: 22, lineHeight: 1.45, color: '#2b2b36'}}>{children}</div>
  </div>
);

const TextOutro = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const line1In = spring({frame, fps, config: {damping: 18, stiffness: 220}});
  const line1Out = interpolate(frame, [24, 36], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line1Opacity = line1In * line1Out;

  const line2In = spring({frame: frame - 26, fps, config: {damping: 18, stiffness: 190}});
  const line2Out = interpolate(frame, [56, 70], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line2Opacity = line2In * line2Out;

  const line3In = spring({frame: frame - 74, fps, config: {damping: 22, stiffness: 170}});
  const morphProgress = interpolate(frame, [90, 112], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const yourOpacity = line3In * (1 - morphProgress);
  const yourMask = interpolate(morphProgress, [0, 1], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const baShiftLeft = interpolate(morphProgress, [0, 1], [0, -18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const myIn = interpolate(morphProgress, [0.2, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const myX = interpolate(morphProgress, [0, 1], [-24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const finalOpacity = interpolate(morphProgress, [0.3, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          width: 1200,
          position: 'relative',
          height: 150,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -1.2,
            color: '#f8f1ff',
            opacity: line1Opacity,
            transform: `translateY(${(1 - line1In) * 16}px) scale(${0.96 + line1In * 0.04})`,
          }}
        >
          Draft faster.
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            opacity: line2Opacity,
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: -1,
              color: '#dbd3eb',
              transform: `translateY(${(1 - line2In) * 90}px)`,
            }}
          >
            Ship stuff.
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            width: 760,
            height: 90,
            margin: '0 auto',
            opacity: line3In,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
              fontSize: 66,
              fontWeight: 650,
              letterSpacing: -0.8,
              color: 'rgba(242,232,255,0.88)',
              opacity: yourOpacity,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                clipPath: `inset(0 0 0 ${yourMask}%)`,
                transform: `translateX(${morphProgress * 12}px)`,
                whiteSpace: 'pre',
              }}
            >
              Your{' '}
            </span>
            <span style={{display: 'inline-block', transform: `translateX(${baShiftLeft}px)`}}>BA.</span>
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: -1.1,
              color: '#ffd987',
              opacity: finalOpacity,
            }}
          >
            <span style={{display: 'inline-block', transform: `translateX(${myX}px)`, opacity: myIn}}>My</span>
            <span style={{display: 'inline-block'}}>BA.dev</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const AITicketShowcase = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const globalZoom = interpolate(frame, [0, durationInFrames], [1.03, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  const boardFadeOut = interpolate(frame, [420, 468], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        background: `radial-gradient(circle at 8% 12%, rgba(80,133,255,0.22), transparent 36%), radial-gradient(circle at 92% 88%, rgba(203,86,255,0.2), transparent 34%), linear-gradient(145deg, ${palette.pageTop} 0%, ${palette.pageBottom} 100%)`,
        transform: `scale(${globalZoom})`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '3px 3px, 7px 7px',
          opacity: 0.18,
        }}
      />

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: boardFadeOut}}>
        <Board frame={frame} />
      </AbsoluteFill>

      <Sequence from={150} durationInFrames={190} premountFor={15}>
        <QuickCreate />
      </Sequence>

      <Sequence from={318} durationInFrames={120} premountFor={10}>
        <GitLabSyncPanel />
      </Sequence>

      <Sequence from={440} durationInFrames={100} premountFor={8}>
        <GitLabIssuePreview />
      </Sequence>

      <Sequence from={540} durationInFrames={110} premountFor={8}>
        <TextOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
