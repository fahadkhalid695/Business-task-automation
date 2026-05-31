import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  Extension as IntegrationIcon,
} from '@mui/icons-material';

export const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      title: 'Create New Task',
      description: 'Start a new automation task',
      icon: <AddIcon />,
      action: () => navigate('/tasks'),
    },
    {
      title: 'Run Workflow',
      description: 'Execute a workflow template',
      icon: <PlayIcon />,
      action: () => navigate('/workflows'),
    },
    {
      title: 'Upload Document',
      description: 'Process a new document',
      icon: <UploadIcon />,
      action: () => navigate('/tasks'),
    },
    {
      title: 'View Analytics',
      description: 'Check performance metrics',
      icon: <AnalyticsIcon />,
      action: () => navigate('/analytics'),
    },
    {
      title: 'Manage Integrations',
      description: 'Configure external services',
      icon: <IntegrationIcon />,
      action: () => navigate('/integrations'),
    },
    {
      title: 'System Settings',
      description: 'Configure platform settings',
      icon: <SettingsIcon />,
      action: () => navigate('/settings'),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Quick Actions"
        subheader="Common tasks and shortcuts"
      />
      <CardContent sx={{ pt: 0 }}>
        <List>
          {quickActions.map((action, index) => (
            <React.Fragment key={action.title}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={action.action}
                  sx={{
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'primary.main' }}>
                    {action.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={action.title}
                    secondary={action.description}
                    primaryTypographyProps={{
                      fontWeight: 500,
                      fontSize: '0.875rem',
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.75rem',
                    }}
                  />
                </ListItemButton>
              </ListItem>
              {index < quickActions.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};
