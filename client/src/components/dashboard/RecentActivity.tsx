import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
  Divider,
  Box,
} from '@mui/material';
import {
  Email as EmailIcon,
  Assignment as TaskIcon,
  Star as AIIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useSocket } from '../../contexts/SocketContext';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: Date;
  icon: React.ReactNode;
  color: 'success' | 'info' | 'primary' | 'warning' | 'error';
}

const generateActivities = (): ActivityItem[] => {
  const now = new Date();
  return [
    {
      id: '1',
      type: 'task_completed',
      title: 'Email categorization completed',
      description: 'Processed 156 emails successfully',
      timestamp: new Date(now.getTime() - 2 * 60000),
      icon: <EmailIcon />,
      color: 'success',
    },
    {
      id: '2',
      type: 'workflow_started',
      title: 'Document generation workflow started',
      description: 'Processing quarterly report',
      timestamp: new Date(now.getTime() - 5 * 60000),
      icon: <TaskIcon />,
      color: 'info',
    },
    {
      id: '3',
      type: 'ai_insight',
      title: 'AI insight generated',
      description: 'Detected pattern in customer inquiries',
      timestamp: new Date(now.getTime() - 12 * 60000),
      icon: <AIIcon />,
      color: 'primary',
    },
    {
      id: '4',
      type: 'error_resolved',
      title: 'Integration health check passed',
      description: 'All services operational',
      timestamp: new Date(now.getTime() - 18 * 60000),
      icon: <SuccessIcon />,
      color: 'success',
    },
    {
      id: '5',
      type: 'task_failed',
      title: 'Data validation warning',
      description: 'Minor format issue detected in import',
      timestamp: new Date(now.getTime() - 25 * 60000),
      icon: <ErrorIcon />,
      color: 'warning',
    },
    {
      id: '6',
      type: 'task_scheduled',
      title: 'Weekly report scheduled',
      description: 'Report will be generated tomorrow at 9 AM',
      timestamp: new Date(now.getTime() - 60 * 60000),
      icon: <ScheduleIcon />,
      color: 'info',
    },
  ];
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export const RecentActivity: React.FC = () => {
  const { isConnected } = useSocket();
  const [activities, setActivities] = useState<ActivityItem[]>(generateActivities());

  // Refresh timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setActivities(generateActivities());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader
        title="Recent Activity"
        subheader="Latest system events"
        action={
          <Chip
            label={isConnected ? 'Live' : 'Offline'}
            color={isConnected ? 'success' : 'default'}
            variant="outlined"
            size="small"
          />
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <List sx={{ p: 0 }}>
          {activities.map((activity, index) => (
            <React.Fragment key={activity.id}>
              <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: `${activity.color}.main`,
                      width: 40,
                      height: 40,
                    }}
                  >
                    {activity.icon}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="subtitle2" fontWeight={500}>
                      {activity.title}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                        sx={{ display: 'block', mb: 0.5 }}
                      >
                        {activity.description}
                      </Typography>
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                      >
                        {formatTimeAgo(activity.timestamp)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < activities.length - 1 && (
                <Divider variant="inset" component="li" />
              )}
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};
