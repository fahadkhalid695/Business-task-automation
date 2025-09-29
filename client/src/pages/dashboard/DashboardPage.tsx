import React from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CardHeader,
  IconButton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Assignment as TaskIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { StatsCard } from '../../components/dashboard/StatsCard';
import { TaskStatusChart } from '../../components/dashboard/TaskStatusChart';
import { RecentActivity } from '../../components/dashboard/RecentActivity';
import { QuickActions } from '../../components/dashboard/QuickActions';

// Mock data
const statsData = [
  {
    title: 'Total Tasks',
    value: '1,247',
    change: '+12%',
    trend: 'up' as const,
    icon: <TaskIcon />,
    color: 'primary' as const,
  },
  {
    title: 'Completed Today',
    value: '89',
    change: '+8%',
    trend: 'up' as const,
    icon: <CheckIcon />,
    color: 'success' as const,
  },
  {
    title: 'Processing Time',
    value: '2.4m',
    change: '-15%',
    trend: 'down' as const,
    icon: <SpeedIcon />,
    color: 'info' as const,
  },
  {
    title: 'Success Rate',
    value: '94.2%',
    change: '+2%',
    trend: 'up' as const,
    icon: <TrendingUpIcon />,
    color: 'warning' as const,
  },
];

const taskTrendData = [
  { name: 'Mon', completed: 45, failed: 3, pending: 12 },
  { name: 'Tue', completed: 52, failed: 2, pending: 8 },
  { name: 'Wed', completed: 48, failed: 4, pending: 15 },
  { name: 'Thu', completed: 61, failed: 1, pending: 6 },
  { name: 'Fri', completed: 55, failed: 3, pending: 10 },
  { name: 'Sat', completed: 38, failed: 2, pending: 5 },
  { name: 'Sun', completed: 42, failed: 1, pending: 8 },
];

const taskTypeData = [
  { name: 'Email Processing', value: 35, color: '#8884d8' },
  { name: 'Document Generation', value: 25, color: '#82ca9d' },
  { name: 'Data Analysis', value: 20, color: '#ffc658' },
  { name: 'Communication', value: 12, color: '#ff7300' },
  { name: 'Other', value: 8, color: '#00ff00' },
];



export const DashboardPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Dashboard - Business Task Automation</title>
      </Helmet>

      <Box>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom data-testid="dashboard-title">
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back! Here's what's happening with your automation platform.
          </Typography>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {statsData.map((stat, index) => (
            <Grid item xs={12} sm={6} lg={3} key={index}>
              <div data-testid="stats-card">
                <StatsCard {...stat} />
              </div>
            </Grid>
          ))}
        </Grid>

        {/* Charts and Analytics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Task Trends */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardHeader
                title="Task Trends"
                subheader="Last 7 days performance"
                action={
                  <IconButton>
                    <MoreVertIcon />
                  </IconButton>
                }
              />
              <CardContent>
                <div data-testid="task-trends-chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={taskTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stackId="1"
                      stroke="#4caf50"
                      fill="#4caf50"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="pending"
                      stackId="1"
                      stroke="#ff9800"
                      fill="#ff9800"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      stackId="1"
                      stroke="#f44336"
                      fill="#f44336"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </Grid>

          {/* Task Distribution */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardHeader
                title="Task Distribution"
                subheader="By task type"
              />
              <CardContent>
                <div data-testid="task-distribution-chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                    <Pie
                      data={taskTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {taskTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent Activity and Quick Actions */}
        <Grid container spacing={3}>
          {/* Recent Activity */}
          <Grid item xs={12} lg={8}>
            <div data-testid="recent-activity">
              <RecentActivity />
            </div>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} lg={4}>
            <div data-testid="quick-actions">
              <QuickActions />
            </div>
          </Grid>
        </Grid>
      </Box>
    </>
  );
};