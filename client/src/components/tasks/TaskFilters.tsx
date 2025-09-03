import React from 'react';
import {
  Menu,
  MenuItem,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  Box,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';

import { TaskStatus, TaskType, Priority } from '../../types';

interface TaskFiltersProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  filters: {
    status: TaskStatus[];
    type: TaskType[];
    priority: Priority[];
  };
  onFiltersChange: (filters: {
    status: TaskStatus[];
    type: TaskType[];
    priority: Priority[];
  }) => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  anchorEl,
  open,
  onClose,
  filters,
  onFiltersChange,
}) => {
  const handleStatusChange = (status: TaskStatus, checked: boolean) => {
    const newStatus = checked
      ? [...filters.status, status]
      : filters.status.filter(s => s !== status);
    
    onFiltersChange({
      ...filters,
      status: newStatus,
    });
  };

  const handleTypeChange = (type: TaskType, checked: boolean) => {
    const newType = checked
      ? [...filters.type, type]
      : filters.type.filter(t => t !== type);
    
    onFiltersChange({
      ...filters,
      type: newType,
    });
  };

  const handlePriorityChange = (priority: Priority, checked: boolean) => {
    const newPriority = checked
      ? [...filters.priority, priority]
      : filters.priority.filter(p => p !== priority);
    
    onFiltersChange({
      ...filters,
      priority: newPriority,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      status: [],
      type: [],
      priority: [],
    });
  };

  const hasActiveFilters = 
    filters.status.length > 0 || 
    filters.type.length > 0 || 
    filters.priority.length > 0;

  const getStatusLabel = (status: TaskStatus) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTypeLabel = (type: TaskType) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPriorityLabel = (priority: Priority) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 320,
          maxHeight: 500,
        },
      }}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Filters</Typography>
        {hasActiveFilters && (
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={clearAllFilters}
            color="primary"
          >
            Clear All
          </Button>
        )}
      </Box>
      
      <Divider />

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Active Filters:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {filters.status.map(status => (
              <Chip
                key={status}
                label={getStatusLabel(status)}
                size="small"
                onDelete={() => handleStatusChange(status, false)}
              />
            ))}
            {filters.type.map(type => (
              <Chip
                key={type}
                label={getTypeLabel(type)}
                size="small"
                onDelete={() => handleTypeChange(type, false)}
              />
            ))}
            {filters.priority.map(priority => (
              <Chip
                key={priority}
                label={getPriorityLabel(priority)}
                size="small"
                onDelete={() => handlePriorityChange(priority, false)}
              />
            ))}
          </Box>
        </Box>
      )}

      {hasActiveFilters && <Divider />}

      {/* Status Filter */}
      <Box sx={{ px: 2, py: 1 }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Status</Typography>
          </FormLabel>
          <FormGroup>
            {Object.values(TaskStatus).map((status) => (
              <FormControlLabel
                key={status}
                control={
                  <Checkbox
                    checked={filters.status.includes(status)}
                    onChange={(e) => handleStatusChange(status, e.target.checked)}
                    size="small"
                  />
                }
                label={getStatusLabel(status)}
                sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
              />
            ))}
          </FormGroup>
        </FormControl>
      </Box>

      <Divider />

      {/* Type Filter */}
      <Box sx={{ px: 2, py: 1 }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Type</Typography>
          </FormLabel>
          <FormGroup>
            {Object.values(TaskType).slice(0, 5).map((type) => (
              <FormControlLabel
                key={type}
                control={
                  <Checkbox
                    checked={filters.type.includes(type)}
                    onChange={(e) => handleTypeChange(type, e.target.checked)}
                    size="small"
                  />
                }
                label={getTypeLabel(type)}
                sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
              />
            ))}
          </FormGroup>
        </FormControl>
      </Box>

      <Divider />

      {/* Priority Filter */}
      <Box sx={{ px: 2, py: 1 }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Priority</Typography>
          </FormLabel>
          <FormGroup>
            {Object.values(Priority).map((priority) => (
              <FormControlLabel
                key={priority}
                control={
                  <Checkbox
                    checked={filters.priority.includes(priority)}
                    onChange={(e) => handlePriorityChange(priority, e.target.checked)}
                    size="small"
                  />
                }
                label={getPriorityLabel(priority)}
                sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
              />
            ))}
          </FormGroup>
        </FormControl>
      </Box>
    </Menu>
  );
};