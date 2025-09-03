import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  LinearProgress,
  Tooltip,
  Button,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { Draggable } from 'react-beautiful-dnd';
import { format } from 'date-fns';

import { Task, TaskStatus, TaskType, Priority } from '../../types';

interface TaskCardProps {
  task: Task;
  variant?: 'card' | 'list';
  index?: number;
  isDragging?: boolean;
}

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return 'success';
    case TaskStatus.IN_PROGRESS:
      return 'info';
    case TaskStatus.FAILED:
      return 'error';
    case TaskStatus.PAUSED:
      return 'warning';
    default:
      return 'default';
  }
};

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case Priority.URGENT:
      return 'error';
    case Priority.HIGH:
      return 'warning';
    case Priority.MEDIUM:
      return 'info';
    default:
      return 'default';
  }
};

const getTypeIcon = (type: TaskType) => {
  // Return appropriate icon based on task type
  return '📋'; // Placeholder
};

const getProgress = (task: Task) => {
  if (task.status === TaskStatus.COMPLETED) return 100;
  if (task.status === TaskStatus.IN_PROGRESS && task.actualDuration && task.estimatedDuration) {
    return Math.min((task.actualDuration / task.estimatedDuration) * 100, 100);
  }
  return 0;
};

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  variant = 'card', 
  index = 0,
  isDragging = false 
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: string) => {
    console.log(`${action} task:`, task.id);
    handleMenuClose();
  };

  const progress = getProgress(task);

  const CardComponent = ({ children }: { children: React.ReactNode }) => {
    if (variant === 'list') {
      return (
        <Card 
          sx={{ 
            mb: 1,
            '&:hover': { boxShadow: 4 },
            transition: 'box-shadow 0.2s',
          }}
        >
          {children}
        </Card>
      );
    }

    return (
      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <Card
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            sx={{
              mb: 1,
              opacity: snapshot.isDragging ? 0.8 : 1,
              transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
              '&:hover': { boxShadow: 4 },
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
          >
            {children}
          </Card>
        )}
      </Draggable>
    );
  };

  return (
    <CardComponent>
      <CardContent sx={{ pb: variant === 'list' ? 2 : 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '1.2em' }}>
              {getTypeIcon(task.type)}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.95rem' }} noWrap>
              {task.title}
            </Typography>
          </Box>
          
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Description */}
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: variant === 'list' ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {task.description}
        </Typography>

        {/* Status and Priority */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={task.status.replace('_', ' ')}
            color={getStatusColor(task.status) as any}
            size="small"
            variant="outlined"
          />
          <Chip
            label={task.priority}
            color={getPriorityColor(task.priority) as any}
            size="small"
          />
        </Box>

        {/* Progress Bar */}
        {task.status === TaskStatus.IN_PROGRESS && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(progress)}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}

        {/* Metadata */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {task.estimatedDuration && (
            <Tooltip title="Estimated Duration">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TimeIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {task.estimatedDuration}m
                </Typography>
              </Box>
            </Tooltip>
          )}
          
          {task.dueDate && (
            <Tooltip title="Due Date">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ScheduleIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(task.dueDate), 'MMM dd')}
                </Typography>
              </Box>
            </Tooltip>
          )}

          <Tooltip title="Assigned To">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Avatar sx={{ width: 20, height: 20, fontSize: '0.7rem' }}>
                {task.assignedTo.charAt(0).toUpperCase()}
              </Avatar>
            </Box>
          </Tooltip>
        </Box>
      </CardContent>

      {/* Actions for list view */}
      {variant === 'list' && (
        <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {task.status === TaskStatus.PENDING && (
              <Button size="small" startIcon={<PlayIcon />} onClick={() => handleAction('start')}>
                Start
              </Button>
            )}
            {task.status === TaskStatus.IN_PROGRESS && (
              <Button size="small" startIcon={<PauseIcon />} onClick={() => handleAction('pause')}>
                Pause
              </Button>
            )}
          </Box>
          
          <Typography variant="caption" color="text.secondary">
            Updated {format(new Date(task.updatedAt), 'MMM dd, HH:mm')}
          </Typography>
        </CardActions>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={() => handleAction('edit')}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => handleAction('duplicate')}>
          <PersonIcon sx={{ mr: 1, fontSize: 20 }} />
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Delete
        </MenuItem>
      </Menu>
    </CardComponent>
  );
};