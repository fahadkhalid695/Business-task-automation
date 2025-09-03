import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  CloudSync as SyncIcon,
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    slack: false,
    taskReminders: true,
    workflowUpdates: true,
    systemAlerts: true,
  });
  const [preferences, setPreferences] = useState({
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/dd/yyyy',
    refreshInterval: 30,
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleNotificationChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setNotifications(prev => ({
      ...prev,
      [key]: event.target.checked,
    }));
  };

  const handlePreferenceChange = (key: string) => (event: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: event.target.value,
    }));
  };

  const saveSettings = () => {
    // In a real app, this would make an API call
    console.log('Saving settings...', { notifications, preferences });
  };

  const exportData = () => {
    console.log('Exporting user data...');
  };

  const deleteAccount = () => {
    console.log('Deleting account...');
  };

  return (
    <>
      <Helmet>
        <title>Settings - Business Task Automation</title>
      </Helmet>
      
      <Box>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your account preferences and platform configuration
          </Typography>
        </Box>

        {/* Settings Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab icon={<EditIcon />} label="Profile" />
            <Tab icon={<PaletteIcon />} label="Appearance" />
            <Tab icon={<NotificationsIcon />} label="Notifications" />
            <Tab icon={<LanguageIcon />} label="Preferences" />
            <Tab icon={<SecurityIcon />} label="Security" />
            <Tab icon={<StorageIcon />} label="Data" />
          </Tabs>
        </Box>

        {/* Profile Settings */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Avatar
                    sx={{
                      width: 100,
                      height: 100,
                      mx: 'auto',
                      mb: 2,
                      bgcolor: 'primary.main',
                      fontSize: '2rem',
                    }}
                  >
                    {user?.email.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="h6" gutterBottom>
                    {user?.email}
                  </Typography>
                  <Chip
                    label={user?.role}
                    color="primary"
                    sx={{ textTransform: 'capitalize', mb: 2 }}
                  />
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setProfileDialogOpen(true)}
                  >
                    Edit Profile
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <Card>
                <CardHeader title="Account Information" />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Email"
                        value={user?.email || ''}
                        fullWidth
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Role"
                        value={user?.role || ''}
                        fullWidth
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Member Since"
                        value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''}
                        fullWidth
                        disabled
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Last Updated"
                        value={user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : ''}
                        fullWidth
                        disabled
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Appearance Settings */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Theme Settings" />
                <CardContent>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Dark Mode"
                        secondary="Switch between light and dark themes"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={isDarkMode}
                          onChange={toggleTheme}
                          color="primary"
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Display Settings" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Dashboard Layout</InputLabel>
                        <Select
                          value="grid"
                          label="Dashboard Layout"
                        >
                          <MenuItem value="grid">Grid Layout</MenuItem>
                          <MenuItem value="list">List Layout</MenuItem>
                          <MenuItem value="compact">Compact Layout</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Sidebar Position</InputLabel>
                        <Select
                          value="left"
                          label="Sidebar Position"
                        >
                          <MenuItem value="left">Left</MenuItem>
                          <MenuItem value="right">Right</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Notification Settings */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Notification Channels" />
                <CardContent>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Email Notifications"
                        secondary="Receive notifications via email"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={notifications.email}
                          onChange={handleNotificationChange('email')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Push Notifications"
                        secondary="Browser push notifications"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={notifications.push}
                          onChange={handleNotificationChange('push')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Slack Integration"
                        secondary="Send notifications to Slack"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={notifications.slack}
                          onChange={handleNotificationChange('slack')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Notification Types" />
                <CardContent>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Task Reminders"
                        secondary="Reminders for pending tasks"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={notifications.taskReminders}
                          onChange={handleNotificationChange('taskReminders')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Workflow Updates"
                        secondary="Updates on workflow progress"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={notifications.workflowUpdates}
                          onChange={handleNotificationChange('workflowUpdates')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="System Alerts"
                        secondary="Important system notifications"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={notifications.systemAlerts}
                          onChange={handleNotificationChange('systemAlerts')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Preferences */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Regional Settings" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Language</InputLabel>
                        <Select
                          value={preferences.language}
                          label="Language"
                          onChange={handlePreferenceChange('language')}
                        >
                          <MenuItem value="en">English</MenuItem>
                          <MenuItem value="es">Spanish</MenuItem>
                          <MenuItem value="fr">French</MenuItem>
                          <MenuItem value="de">German</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Timezone</InputLabel>
                        <Select
                          value={preferences.timezone}
                          label="Timezone"
                          onChange={handlePreferenceChange('timezone')}
                        >
                          <MenuItem value="UTC">UTC</MenuItem>
                          <MenuItem value="America/New_York">Eastern Time</MenuItem>
                          <MenuItem value="America/Chicago">Central Time</MenuItem>
                          <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Date Format</InputLabel>
                        <Select
                          value={preferences.dateFormat}
                          label="Date Format"
                          onChange={handlePreferenceChange('dateFormat')}
                        >
                          <MenuItem value="MM/dd/yyyy">MM/DD/YYYY</MenuItem>
                          <MenuItem value="dd/MM/yyyy">DD/MM/YYYY</MenuItem>
                          <MenuItem value="yyyy-MM-dd">YYYY-MM-DD</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="System Preferences" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        label="Auto-refresh Interval (seconds)"
                        type="number"
                        value={preferences.refreshInterval}
                        onChange={handlePreferenceChange('refreshInterval')}
                        fullWidth
                        inputProps={{ min: 10, max: 300 }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Security Settings */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardHeader title="Security Settings" />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => setChangePasswordDialogOpen(true)}
                      >
                        Change Password
                      </Button>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Button
                        variant="outlined"
                        fullWidth
                        disabled
                      >
                        Enable Two-Factor Auth
                      </Button>
                    </Grid>
                  </Grid>
                  
                  <Divider sx={{ my: 3 }} />
                  
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Your account is secured with industry-standard encryption and security measures.
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Data Management */}
        <TabPanel value={tabValue} index={5}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Data Export" />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Export your data including tasks, workflows, and settings.
                  </Typography>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={exportData}
                    startIcon={<SyncIcon />}
                  >
                    Export Data
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Account Deletion" />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Permanently delete your account and all associated data.
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    onClick={deleteAccount}
                    startIcon={<DeleteIcon />}
                  >
                    Delete Account
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Save Button */}
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            onClick={saveSettings}
            sx={{ minWidth: 120 }}
          >
            Save Changes
          </Button>
        </Box>
      </Box>
    </>
  );
};