import React from 'react';
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

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
  color: 'success' | 'info' | 'primary' | 'warning' | 'error';
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'task_completed',
    title: 'Email categorization completed',
    description: 'Processed 156 emails successfully',
    timestamp: '2 minutes ago',
    icon: <EmailIcon />,
    color: 'success' as const,
  },
  {
    id: '2',
    type: 'workflow_started',
    title: 'Document generation workflow started',
    description: 'Processing quarterly report',
    timestamp: '5 minutes ago',
    icon: <TaskIcon />,
    color: 'info' as const,
  },
  {
    id: '3',
    type: 'ai_insight',
    title: 'AI insight generated',
    description: 'Detected pattern in customer inquiries',
    timestamp: '12 minutes ago',
    icon: <AIIcon />,
    color: 'primary' as const,
  },
  {
    id: '4',
    type: 'error_resolved',
    title: 'Integration error resolved',
    description: 'Gmail API connection restored',
    timestamp: '18 minutes ago',
    icon: <SuccessIcon />,
    color: 'success' as const,
  },
  {
    id: '5',
    type: 'task_failed',
    title: 'Data processing failed',
    description: 'Invalid data format detected',
    timestamp: '25 minutes ago',
    icon: <ErrorIcon />,
    color: 'error' as const,
  },
  {
    id: '6',
    type: 'task_scheduled',
    title: 'Weekly report scheduled',
    description: 'Report will be generated tomorrow at 9 AM',
    timestamp: '1 hour ago',
    icon: <ScheduleIcon />,
    color: 'info' as const,
  },
];

export const RecentActivity: React.FC = () => {
  return (
    <Card>
      <CardHeader
        title="Recent Activity"
        subheader="Latest system events"
        action={
          <Chip
            label="Live"
            color="success"
            variant="outlined"
            size="small"
          />
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <List sx={{ p: 0 }}>
          {mockActivities.map((activity, index) => (
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
                        {activity.timestamp}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < mockActivities.length - 1 && (
                <Divider variant="inset" component="li" />
              )}
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};