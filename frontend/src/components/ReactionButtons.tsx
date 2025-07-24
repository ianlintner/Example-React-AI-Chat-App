import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Fade,
} from '@mui/material';
import {
  ThumbUp as ThumbUpIcon,
  SentimentVeryDissatisfied as GroanIcon,
  Favorite as LoveIcon,
  SentimentNeutral as MehIcon,
  ThumbDown as DislikeIcon,
} from '@mui/icons-material';

interface ReactionButtonsProps {
  messageId: string;
  onReaction: (reactionType: string) => void;
  disabled?: boolean;
}

const ReactionButtons: React.FC<ReactionButtonsProps> = ({
  messageId,
  onReaction,
  disabled = false,
}) => {
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [showButtons, setShowButtons] = useState(false);

  const reactions = [
    { type: 'laugh', icon: ThumbUpIcon, label: 'Funny!', color: '#4caf50' },
    { type: 'groan', icon: GroanIcon, label: 'Groan-worthy', color: '#ff9800' },
    { type: 'love', icon: LoveIcon, label: 'Love it!', color: '#e91e63' },
    { type: 'meh', icon: MehIcon, label: 'Meh', color: '#9e9e9e' },
    { type: 'dislike', icon: DislikeIcon, label: 'Not funny', color: '#f44336' },
  ];

  const handleReaction = (reactionType: string) => {
    if (disabled || selectedReaction) return;
    
    console.log(`Recording reaction ${reactionType} for message ${messageId}`);
    setSelectedReaction(reactionType);
    onReaction(reactionType);
    
    // Hide buttons after selection
    setTimeout(() => {
      setShowButtons(false);
    }, 2000);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mt: 1,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={() => !selectedReaction && setShowButtons(true)}
      onMouseLeave={() => !selectedReaction && setShowButtons(false)}
    >
      {!selectedReaction && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: '0.7rem',
            opacity: showButtons ? 1 : 0.6,
            transition: 'opacity 0.2s',
          }}
        >
          How was this joke?
        </Typography>
      )}

      <Fade in={showButtons || selectedReaction !== null} timeout={200}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {reactions.map((reaction) => {
            const Icon = reaction.icon;
            const isSelected = selectedReaction === reaction.type;
            
            return (
              <Tooltip key={reaction.type} title={reaction.label} arrow>
                <IconButton
                  size="small"
                  onClick={() => handleReaction(reaction.type)}
                  disabled={disabled || (selectedReaction !== null && !isSelected)}
                  sx={{
                    width: 28,
                    height: 28,
                    color: isSelected ? reaction.color : 'text.secondary',
                    backgroundColor: isSelected ? `${reaction.color}20` : 'transparent',
                    border: isSelected ? `1px solid ${reaction.color}` : '1px solid transparent',
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: `${reaction.color}15`,
                      color: reaction.color,
                      transform: 'scale(1.05)',
                    },
                    '&:disabled': {
                      opacity: 0.3,
                    },
                  }}
                >
                  <Icon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            );
          })}
        </Box>
      </Fade>

      {selectedReaction && (
        <Fade in timeout={300}>
          <Typography
            variant="caption"
            color="primary"
            sx={{
              fontSize: '0.7rem',
              fontWeight: 500,
              ml: 1,
            }}
          >
            Thanks for the feedback! 🎯
          </Typography>
        </Fade>
      )}
    </Box>
  );
};

export default ReactionButtons;
