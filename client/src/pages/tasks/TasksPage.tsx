import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

import { TaskCard } from '../../components/tasks/TaskCard';
import { TaskFilters } from '../../components/tasks/TaskFilters';
import { CreateTaskDialog } from '../../components/tasks/CreateTaskDialog';
import { TaskStatusColumn } from '../../components/tasks/TaskStatusColumn';
import { useSocket } from '../../contexts/SocketContext';
import { Task, TaskStatus, TaskType, Priority } from '../../types';

// Mock data
const mockTasks: Task[] = [
  {
    id: '1',
    type: TaskType.EMAIL_PROCESSING,
    status: TaskStatus.PENDING,
    priority: Priority.HIGH,
    assignedTo: 'user1',
    createdBy: 'user1',
    title: 'Process customer inquiries',
    description: 'Categorize and respond to customer emails from support inbox',
    data: {
      input: { emailCount: 45 },
      context: { userId: 'user1', metadata: {} },
    },
    workflow: [],
    estimatedDuration: 30,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    dueDate: '2024-01-15T18:00:00Z',
  },
  {
    id: '2',
    type: TaskType.DOCUMENT_GENERATION,
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.MEDIUM,
    assignedTo: 'user1',
    createdBy: 'user1',
    title: 'Generate monthly report',
    description: 'Create comprehensive monthly performance report',
    data: {
      input: { reportType: 'monthly', period: '2024-01' },
      context: { userId: 'user1', metadata: {} },
    },
    workflow: [],
    estimatedDuration: 60,
    actualDuration: 25,
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '3',
    type: TaskType.DATA_ANALYSIS,
    status: TaskStatus.COMPLETED,
    priority: Priority.LOW,
    assignedTo: 'user1',
    createdBy: 'user1',
    title: 'Analyze sales data',
    description: 'Process and analyze Q4 sales performance data',
    data: {
      input: { dataSource: 'sales_db', quarter: 'Q4' },
      output: { insights: ['Revenue up 15%', 'Top product: Widget A'] },
      context: { userId: 'user1', metadata: {} },
    },
    workflow: [],
    estimatedDuration: 45,
    actualDuration: 42,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T09:30:00Z',
    completedAt: '2024-01-15T08:42:00Z',
  },
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
      id={`task-tabpanel-${index}`}
      aria-labelledby={`task-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>(mockTasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    status: [] as TaskStatus[],
    type: [] as TaskType[],
    priority: [] as Priority[],
  });
  const [tabValue, setTabValue] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  
  const { socket, isConnected } = useSocket();

  // Real-time updates via WebSocket
  useEffect(() => {
    if (socket) {
      socket.on('task:updated', (updatedTask: Task) => {
        setTasks(prev => prev.map(task => 
          task.id === updatedTask.id ? updatedTask : task
        ));
      });

      socket.on('task:created', (newTask: Task) => {
        setTasks(prev => [...prev, newTask]);
      });

      socket.on('task:deleted', (taskId: string) => {
        setTasks(prev => prev.filter(task => task.id !== taskId));
      });

      return () => {
        socket.off('task:updated');
        socket.off('task:created');
        socket.off('task:deleted');
      };
    }
  }, [socket]);

  // Filter tasks based on search and filters
  useEffect(() => {
    let filtered = tasks;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (selectedFilters.status.length > 0) {
      filtered = filtered.filter(task => selectedFilters.status.includes(task.status));
    }

    // Type filter
    if (selectedFilters.type.length > 0) {
      filtered = filtered.filter(task => selectedFilters.type.includes(task.type));
    }

    // Priority filter
    if (selectedFilters.priority.length > 0) {
      filtered = filtered.filter(task => selectedFilters.priority.includes(task.priority));
    }

    setFilteredTasks(filtered);
  }, [tasks, searchQuery, selectedFilters]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId) return;

    // Update task status based on column
    const newStatus = destination.droppableId as TaskStatus;
    
    setTasks(prev => prev.map(task => 
      task.id === draggableId 
        ? { ...task, status: newStatus, updatedAt: new Date().toISOString() }
        : task
    ));

    // Emit socket event for real-time updates
    if (socket) {
      socket.emit('task:updateStatus', { taskId: draggableId, status: newStatus });
    }
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter(task => task.status === status);
  };

  const getTaskCountByStatus = (status: TaskStatus) => {
    return getTasksByStatus(status).length;
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFilterMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const handleFilterMenuClose = () => {
    setFilterMenuAnchor(null);
  };

  const refreshTasks = () => {
    // In a real app, this would fetch from API
    console.log('Refreshing tasks...');
  };

  return (
    <>
      <Helmet>
        <title>Tasks - Business Task Automation</title>
      </Helmet>
      
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Tasks
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and monitor your automation tasks
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Badge
              color={isConnected ? 'success' : 'error'}
              variant="dot"
              sx={{ mr: 2 }}
            >
              <Typography variant="caption" color="text.secondary">
                {isConnected ? 'Live' : 'Offline'}
              </Typography>
            </Badge>
            
            <IconButton onClick={refreshTasks} color="primary">
              <RefreshIcon />
            </IconButton>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Task
            </Button>
          </Box>
        </Box>

        {/* Search and Filters */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  startIcon={<FilterIcon />}
                  onClick={handleFilterMenuOpen}
                  variant="outlined"
                >
                  Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Task View Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Kanban Board
                  <Chip size="small" label={filteredTasks.length} />
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  List View
                  <Chip size="small" label={filteredTasks.length} />
                </Box>
              } 
            />
          </Tabs>
        </Box>

        {/* Kanban Board View */}
        <TabPanel value={tabValue} index={0}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Grid container spacing={2}>
              {Object.values(TaskStatus).map((status) => (
                <Grid item xs={12} md={3} key={status}>
                  <TaskStatusColumn
                    status={status}
                    tasks={getTasksByStatus(status)}
                    count={getTaskCountByStatus(status)}
                  />
                </Grid>
              ))}
            </Grid>
          </DragDropContext>
        </TabPanel>

        {/* List View */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2}>
            {filteredTasks.map((task) => (
              <Grid item xs={12} key={task.id}>
                <TaskCard task={task} variant="list" />
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Floating Action Button */}
        <Fab
          color="primary"
          aria-label="add task"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={() => setCreateDialogOpen(true)}
        >
          <AddIcon />
        </Fab>

        {/* Create Task Dialog */}
        <CreateTaskDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onTaskCreated={(task) => {
            setTasks(prev => [...prev, task]);
            setCreateDialogOpen(false);
          }}
        />

        {/* Filter Menu */}
        <TaskFilters
          anchorEl={filterMenuAnchor}
          open={Boolean(filterMenuAnchor)}
          onClose={handleFilterMenuClose}
          filters={selectedFilters}
          onFiltersChange={setSelectedFilters}
        />
      </Box>
    </>
  );
};