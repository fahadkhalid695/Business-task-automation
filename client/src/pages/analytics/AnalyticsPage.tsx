import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
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
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';

import { StatsCard } from '../../components/dashboard/StatsCard';

// Mock data
const performanceData = [
  { month: 'Jan', tasks: 1200, completed: 1140, failed: 60, avgTime: 2.3 },
  { month: 'Feb', tasks: 1350, completed: 1283, failed: 67, avgTime: 2.1 },
  { month: 'Mar', tasks: 1180, completed: 1121, failed: 59, avgTime: 2.4 },
  { month: 'Apr', tasks: 1420, completed: 1349, failed: 71, avgTime: 2.0 },
  { month: 'May', tasks: 1580, completed: 1501, failed: 79, avgTime: 1.9 },
  { month: 'Jun', tasks: 1650, completed: 1567, failed: 83, avgTime: 1.8 },
];

const taskTypeDistribution = [
  { name: 'Email Processing', value: 35, color: '#8884d8', count: 542 },
  { name: 'Document Generation', value: 25, color: '#82ca9d', count: 387 },
  { name: 'Data Analysis', value: 20, color: '#ffc658', count: 310 },
  { name: 'Communication', value: 12, color: '#ff7300', count: 186 },
  { name: 'Project Management', value: 5, color: '#00ff00', count: 77 },
  { name: 'Other', value: 3, color: '#ff0000', count: 46 },
];

const topPerformers = [
  { name: 'Email Categorization', completionRate: 98.5, avgTime: 1.2, totalTasks: 234 },
  { name: 'Report Generation', completionRate: 96.8, avgTime: 3.4, totalTasks: 156 },
  { name: 'Data Cleaning', completionRate: 94.2, avgTime: 2.1, totalTasks: 189 },
  { name: 'Calendar Management', completionRate: 92.7, avgTime: 1.8, totalTasks: 98 },
  { name: 'Document Processing', completionRate: 91.3, avgTime: 4.2, totalTasks: 145 },
];

const efficiencyTrends = [
  { week: 'W1', efficiency: 85, throughput: 120, errorRate: 3.2 },
  { week: 'W2', efficiency: 87, throughput: 135, errorRate: 2.8 },
  { week: 'W3', efficiency: 89, throughput: 142, errorRate: 2.5 },
  { week: 'W4', efficiency: 91, throughput: 158, errorRate: 2.1 },
  { week: 'W5', efficiency: 93, throughput: 165, errorRate: 1.9 },
  { week: 'W6', efficiency: 95, throughput: 172, errorRate: 1.6 },
];

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
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const AnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState('6months');
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const exportData = () => {
    console.log('Exporting analytics data...');
  };

  const refreshData = () => {
    console.log('Refreshing analytics data...');
  };

  const currentMonth = performanceData[performanceData.length - 1];
  const previousMonth = performanceData[performanceData.length - 2];
  
  const completionRate = ((currentMonth.completed / currentMonth.tasks) * 100).toFixed(1);
  const completionRateChange = (
    ((currentMonth.completed / currentMonth.tasks) - (previousMonth.completed / previousMonth.tasks)) * 100
  ).toFixed(1);

  const avgTimeChange = ((currentMonth.avgTime - previousMonth.avgTime) / previousMonth.avgTime * 100).toFixed(1);

  const statsData = [
    {
      title: 'Total Tasks',
      value: currentMonth.tasks.toLocaleString(),
      change: `+${((currentMonth.tasks - previousMonth.tasks) / previousMonth.tasks * 100).toFixed(1)}%`,
      trend: 'up' as const,
      icon: <TrendingUpIcon />,
      color: 'primary' as const,
    },
    {
      title: 'Completion Rate',
      value: `${completionRate}%`,
      change: `${completionRateChange > '0' ? '+' : ''}${completionRateChange}%`,
      trend: parseFloat(completionRateChange) >= 0 ? 'up' as const : 'down' as const,
      icon: <TrendingUpIcon />,
      color: 'success' as const,
    },
    {
      title: 'Avg Processing Time',
      value: `${currentMonth.avgTime}m`,
      change: `${avgTimeChange > '0' ? '+' : ''}${avgTimeChange}%`,
      trend: parseFloat(avgTimeChange) <= 0 ? 'up' as const : 'down' as const,
      icon: <TrendingUpIcon />,
      color: 'info' as const,
    },
    {
      title: 'Failed Tasks',
      value: currentMonth.failed.toString(),
      change: `${((currentMonth.failed - previousMonth.failed) / previousMonth.failed * 100).toFixed(1)}%`,
      trend: currentMonth.failed < previousMonth.failed ? 'up' as const : 'down' as const,
      icon: <TrendingDownIcon />,
      color: 'warning' as const,
    },
  ];

  return (
    <>
      <Helmet>
        <title>Analytics - Business Task Automation</title>
      </Helmet>
      
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Analytics
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Performance metrics and insights for your automation platform
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                label="Time Range"
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="1month">1 Month</MenuItem>
                <MenuItem value="3months">3 Months</MenuItem>
                <MenuItem value="6months">6 Months</MenuItem>
                <MenuItem value="1year">1 Year</MenuItem>
              </Select>
            </FormControl>
            
            <Tooltip title="Refresh Data">
              <IconButton onClick={refreshData} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Export Data">
              <IconButton onClick={exportData} color="primary">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {statsData.map((stat, index) => (
            <Grid item xs={12} sm={6} lg={3} key={index}>
              <StatsCard {...stat} />
            </Grid>
          ))}
        </Grid>

        {/* Analytics Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Performance Overview" />
            <Tab label="Task Distribution" />
            <Tab label="Efficiency Trends" />
            <Tab label="Top Performers" />
          </Tabs>
        </Box>

        {/* Performance Overview */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardHeader
                  title="Task Performance Trends"
                  subheader="Monthly task completion and processing metrics"
                />
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <RechartsTooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="completed" fill="#4caf50" name="Completed Tasks" />
                      <Bar yAxisId="left" dataKey="failed" fill="#f44336" name="Failed Tasks" />
                      <Line yAxisId="right" type="monotone" dataKey="avgTime" stroke="#ff9800" strokeWidth={3} name="Avg Time (min)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} lg={4}>
              <Card>
                <CardHeader
                  title="Success Rate"
                  subheader="Overall completion percentage"
                />
                <CardContent>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h2" color="success.main" fontWeight="bold">
                      {completionRate}%
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                      Average success rate
                    </Typography>
                    <Chip
                      label={`${completionRateChange > '0' ? '+' : ''}${completionRateChange}% vs last month`}
                      color={parseFloat(completionRateChange) >= 0 ? 'success' : 'error'}
                      sx={{ mt: 2 }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Task Distribution */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader
                  title="Task Type Distribution"
                  subheader="Breakdown by task category"
                />
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={taskTypeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={150}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {taskTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader
                  title="Task Volume by Type"
                  subheader="Detailed breakdown with counts"
                />
                <CardContent>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Task Type</TableCell>
                          <TableCell align="right">Count</TableCell>
                          <TableCell align="right">Percentage</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {taskTypeDistribution.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    bgcolor: row.color,
                                  }}
                                />
                                {row.name}
                              </Box>
                            </TableCell>
                            <TableCell align="right">{row.count}</TableCell>
                            <TableCell align="right">{row.value}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Efficiency Trends */}
        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardHeader
              title="Efficiency Metrics"
              subheader="Weekly efficiency, throughput, and error rate trends"
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={efficiencyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="efficiency" fill="#4caf50" fillOpacity={0.6} stroke="#4caf50" name="Efficiency %" />
                  <Bar yAxisId="right" dataKey="throughput" fill="#2196f3" name="Throughput" />
                  <Line yAxisId="right" type="monotone" dataKey="errorRate" stroke="#f44336" strokeWidth={3} name="Error Rate %" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Top Performers */}
        <TabPanel value={tabValue} index={3}>
          <Card>
            <CardHeader
              title="Top Performing Tasks"
              subheader="Best performing automation tasks by completion rate"
            />
            <CardContent>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Task Name</TableCell>
                      <TableCell align="right">Completion Rate</TableCell>
                      <TableCell align="right">Avg Time (min)</TableCell>
                      <TableCell align="right">Total Tasks</TableCell>
                      <TableCell align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topPerformers.map((task, index) => (
                      <TableRow key={task.name}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={500}>
                            {task.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={task.completionRate >= 95 ? 'success.main' : task.completionRate >= 90 ? 'warning.main' : 'error.main'}
                            fontWeight={500}
                          >
                            {task.completionRate}%
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{task.avgTime}</TableCell>
                        <TableCell align="right">{task.totalTasks}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={task.completionRate >= 95 ? 'Excellent' : task.completionRate >= 90 ? 'Good' : 'Needs Improvement'}
                            color={task.completionRate >= 95 ? 'success' : task.completionRate >= 90 ? 'warning' : 'error'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </TabPanel>
      </Box>
    </>
  );
};