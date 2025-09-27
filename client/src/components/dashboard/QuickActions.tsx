import React from 'react';
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

const quickActions = [
  {
    title: 'Create New Task',
    description: 'Start a new automation task',
    icon: <AddIcon />,
    action: () => console.log('Create task'),
  },
  {
    title: 'Run Workflow',
    description: 'Execute a workflow template',
    icon: <PlayIcon />,
    action: () => console.log('Run workflow'),
  },
  {
    title: 'Upload Document',
    description: 'Process a new document',
    icon: <UploadIcon />,
    action: () => console.log('Upload document'),
  },
  {
    title: 'View Analytics',
    description: 'Check performance metrics',
    icon: <AnalyticsIcon />,
    action: () => console.log('View analytics'),
  },
  {
    title: 'Manage Integrations',
    description: 'Configure external services',
    icon: <IntegrationIcon />,
    action: () => console.log('Manage integrations'),
  },
  {
    title: 'System Settings',
    description: 'Configure platform settings',
    icon: <SettingsIcon />,
    action: () => console.log('System settings'),
  },
];

export const QuickActions: React.FC = () => {
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