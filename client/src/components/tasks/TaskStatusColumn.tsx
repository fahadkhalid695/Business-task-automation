import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Badge,
} from '@mui/material';
import {
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  PlayArrow as InProgressIcon,
  Error as FailedIcon,
  Pause as PausedIcon,
  Cancel as CancelledIcon,
} from '@mui/icons-material';
import { Droppable } from 'react-beautiful-dnd';

import { Task, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';

interface TaskStatusColumnProps {
  status: TaskStatus;
  tasks: Task[];
  count: number;
}

const getStatusConfig = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.PENDING:
      return {
        title: 'Pending',
        icon: <PendingIcon />,
        color: '#ed6c02',
        bgColor: '#fff3e0',
      };
    case TaskStatus.IN_PROGRESS:
      return {
        title: 'In Progress',
        icon: <InProgressIcon />,
        color: '#0288d1',
        bgColor: '#e3f2fd',
      };
    case TaskStatus.COMPLETED:
      return {
        title: 'Completed',
        icon: <CompletedIcon />,
        color: '#2e7d32',
        bgColor: '#e8f5e8',
      };
    case TaskStatus.FAILED:
      return {
        title: 'Failed',
        icon: <FailedIcon />,
        color: '#d32f2f',
        bgColor: '#ffebee',
      };
    case TaskStatus.PAUSED:
      return {
        title: 'Paused',
        icon: <PausedIcon />,
        color: '#f57c00',
        bgColor: '#fff8e1',
      };
    case TaskStatus.CANCELLED:
      return {
        title: 'Cancelled',
        icon: <CancelledIcon />,
        color: '#616161',
        bgColor: '#f5f5f5',
      };
    default:
      return {
        title: status,
        icon: <PendingIcon />,
        color: '#757575',
        bgColor: '#f5f5f5',
      };
  }
};

export const TaskStatusColumn: React.FC<TaskStatusColumnProps> = ({
  status,
  tasks,
  count,
}) => {
  const config = getStatusConfig(status);

  return (
    <Paper
      elevation={1}
      sx={{
        height: '100%',
        minHeight: 600,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: config.bgColor,
        border: `1px solid ${config.color}20`,
      }}
    >
      {/* Column Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `2px solid ${config.color}30`,
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: config.color, display: 'flex', alignItems: 'center' }}>
              {config.icon}
            </Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: config.color }}>
              {config.title}
            </Typography>
          </Box>
          
          <Badge
            badgeContent={count}
            color="primary"
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: config.color,
                color: 'white',
              },
            }}
          >
            <Box />
          </Badge>
        </Box>
      </Box>

      {/* Droppable Area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              flex: 1,
              p: 1,
              bgcolor: snapshot.isDraggingOver ? `${config.color}10` : 'transparent',
              transition: 'background-color 0.2s ease',
              minHeight: 200,
            }}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                variant="card"
              />
            ))}
            {provided.placeholder}
            
            {/* Empty State */}
            {tasks.length === 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 100,
                  border: `2px dashed ${config.color}40`,
                  borderRadius: 2,
                  color: 'text.secondary',
                  mt: 1,
                }}
              >
                <Typography variant="body2">
                  Drop tasks here
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Droppable>
    </Paper>
  );
};