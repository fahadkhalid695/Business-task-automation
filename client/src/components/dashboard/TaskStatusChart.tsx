import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  Error as FailedIcon,
  Pause as PausedIcon,
} from '@mui/icons-material';

interface TaskStatusData {
  status: string;
  count: number;
  percentage: number;
  color: string;
  icon: React.ReactNode;
}

const mockStatusData: TaskStatusData[] = [
  {
    status: 'Completed',
    count: 156,
    percentage: 78,
    color: '#4caf50',
    icon: <CompletedIcon />,
  },
  {
    status: 'In Progress',
    count: 32,
    percentage: 16,
    color: '#2196f3',
    icon: <PendingIcon />,
  },
  {
    status: 'Failed',
    count: 8,
    percentage: 4,
    color: '#f44336',
    icon: <FailedIcon />,
  },
  {
    status: 'Paused',
    count: 4,
    percentage: 2,
    color: '#ff9800',
    icon: <PausedIcon />,
  },
];

export const TaskStatusChart: React.FC = () => {
  const totalTasks = mockStatusData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader
        title="Task Status Overview"
        subheader={`Total: ${totalTasks} tasks`}
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {mockStatusData.map((item) => (
            <Box key={item.status}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: item.color, display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </Box>
                  <Typography variant="body2" fontWeight={500}>
                    {item.status}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {item.count}
                  </Typography>
                  <Chip
                    label={`${item.percentage}%`}
                    size="small"
                    sx={{
                      bgcolor: item.color,
                      color: 'white',
                      fontWeight: 500,
                      minWidth: 45,
                    }}
                  />
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={item.percentage}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: item.color,
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};