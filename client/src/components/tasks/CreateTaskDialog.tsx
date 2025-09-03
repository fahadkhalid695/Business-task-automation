import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Grid,
  Chip,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  AttachFile as AttachIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { Task, TaskType, Priority, TaskStatus } from '../../types';

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onTaskCreated: (task: Task) => void;
}

interface TaskFormData {
  title: string;
  description: string;
  type: TaskType;
  priority: Priority;
  estimatedDuration: number;
  dueDate: string;
}

const schema = yup.object({
  title: yup.string().required('Title is required').min(3, 'Title must be at least 3 characters'),
  description: yup.string().required('Description is required'),
  type: yup.string().required('Task type is required'),
  priority: yup.string().required('Priority is required'),
  estimatedDuration: yup.number().positive('Duration must be positive').required('Estimated duration is required'),
  dueDate: yup.string().required('Due date is required'),
});

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onClose,
  onTaskCreated,
}) => {
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      type: TaskType.EMAIL_PROCESSING,
      priority: Priority.MEDIUM,
      estimatedDuration: 30,
      dueDate: '',
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setAttachments(prev => [...prev, ...acceptedFiles]);
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleClose = () => {
    reset();
    setAttachments([]);
    onClose();
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    
    try {
      // In a real app, this would make an API call
      const newTask: Task = {
        id: `task_${Date.now()}`,
        type: data.type,
        status: TaskStatus.PENDING,
        priority: data.priority,
        assignedTo: 'current_user', // Would come from auth context
        createdBy: 'current_user',
        title: data.title,
        description: data.description,
        data: {
          input: {},
          context: {
            userId: 'current_user',
            metadata: {
              attachments: attachments.map(file => ({
                name: file.name,
                size: file.size,
                type: file.type,
              })),
            },
          },
        },
        workflow: [],
        estimatedDuration: data.estimatedDuration,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: data.dueDate,
      };

      onTaskCreated(newTask);
      handleClose();
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeLabel = (type: TaskType) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPriorityLabel = (priority: Priority) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 600 },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Create New Task</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Basic Information
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Task Title"
                    fullWidth
                    error={!!errors.title}
                    helperText={errors.title?.message}
                    placeholder="Enter a descriptive title for your task"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={3}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                    placeholder="Describe what this task should accomplish"
                  />
                )}
              />
            </Grid>

            {/* Task Configuration */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600} sx={{ mt: 2 }}>
                Configuration
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.type}>
                    <InputLabel>Task Type</InputLabel>
                    <Select {...field} label="Task Type">
                      {Object.values(TaskType).map((type) => (
                        <MenuItem key={type} value={type}>
                          {getTypeLabel(type)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.priority}>
                    <InputLabel>Priority</InputLabel>
                    <Select {...field} label="Priority">
                      {Object.values(Priority).map((priority) => (
                        <MenuItem key={priority} value={priority}>
                          {getPriorityLabel(priority)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="estimatedDuration"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Estimated Duration (minutes)"
                    type="number"
                    fullWidth
                    error={!!errors.estimatedDuration}
                    helperText={errors.estimatedDuration?.message}
                    inputProps={{ min: 1 }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="dueDate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Due Date"
                    type="datetime-local"
                    fullWidth
                    error={!!errors.dueDate}
                    helperText={errors.dueDate?.message}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>

            {/* File Attachments */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600} sx={{ mt: 2 }}>
                Attachments
              </Typography>
              
              <Paper
                {...getRootProps()}
                sx={{
                  p: 3,
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'grey.300',
                  bgcolor: isDragActive ? 'primary.50' : 'grey.50',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                  },
                }}
              >
                <input {...getInputProps()} />
                <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" gutterBottom>
                  {isDragActive
                    ? 'Drop files here...'
                    : 'Drag & drop files here, or click to select'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Maximum file size: 10MB
                </Typography>
              </Paper>

              {/* Attachment List */}
              {attachments.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Attached Files ({attachments.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {attachments.map((file, index) => (
                      <Chip
                        key={index}
                        icon={<AttachIcon />}
                        label={`${file.name} (${(file.size / 1024).toFixed(1)}KB)`}
                        onDelete={() => removeAttachment(index)}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            sx={{ minWidth: 120 }}
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};