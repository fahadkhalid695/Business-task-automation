import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Visibility as PreviewIcon,
  DragIndicator as DragIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  configuration: any;
  dependencies: string[];
  timeout?: number;
  retryCount?: number;
  order: number;
}

enum StepType {
  AI_PROCESSING = 'ai_processing',
  DATA_TRANSFORMATION = 'data_transformation',
  EXTERNAL_API_CALL = 'external_api_call',
  USER_APPROVAL = 'user_approval',
  NOTIFICATION = 'notification',
  CONDITIONAL = 'conditional'
}

interface WorkflowTemplate {
  id?: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
  triggers: any[];
  isActive: boolean;
}

interface WorkflowBuilderProps {
  template?: WorkflowTemplate;
  onSave: (template: WorkflowTemplate) => void;
  onTest?: (template: WorkflowTemplate) => void;
  categories: string[];
}

const stepTypeLabels = {
  [StepType.AI_PROCESSING]: 'AI Processing',
  [StepType.DATA_TRANSFORMATION]: 'Data Transformation',
  [StepType.EXTERNAL_API_CALL]: 'External API Call',
  [StepType.USER_APPROVAL]: 'User Approval',
  [StepType.NOTIFICATION]: 'Notification',
  [StepType.CONDITIONAL]: 'Conditional Logic'
};

const stepTypeColors = {
  [StepType.AI_PROCESSING]: '#9c27b0',
  [StepType.DATA_TRANSFORMATION]: '#2196f3',
  [StepType.EXTERNAL_API_CALL]: '#ff9800',
  [StepType.USER_APPROVAL]: '#4caf50',
  [StepType.NOTIFICATION]: '#f44336',
  [StepType.CONDITIONAL]: '#795548'
};

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  template,
  onSave,
  onTest,
  categories
}) => {
  const [workflowTemplate, setWorkflowTemplate] = useState<WorkflowTemplate>(
    template || {
      name: '',
      description: '',
      category: '',
      steps: [],
      triggers: [],
      isActive: true
    }
  );

  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const stepIdCounter = useRef(1);

  const generateStepId = useCallback(() => {
    return `step_${stepIdCounter.current++}_${Math.random().toString(36).substring(2, 8)}`;
  }, []);

  const handleAddStep = useCallback((stepType: StepType) => {
    const newStep: WorkflowStep = {
      id: generateStepId(),
      name: `New ${stepTypeLabels[stepType]}`,
      type: stepType,
      configuration: getDefaultConfiguration(stepType),
      dependencies: [],
      order: workflowTemplate.steps.length + 1
    };

    setSelectedStep(newStep);
    setStepDialogOpen(true);
  }, [workflowTemplate.steps.length, generateStepId]);

  const handleEditStep = useCallback((step: WorkflowStep) => {
    setSelectedStep({ ...step });
    setStepDialogOpen(true);
  }, []);

  const handleSaveStep = useCallback((step: WorkflowStep) => {
    const updatedSteps = [...workflowTemplate.steps];
    const existingIndex = updatedSteps.findIndex(s => s.id === step.id);

    if (existingIndex >= 0) {
      updatedSteps[existingIndex] = step;
    } else {
      updatedSteps.push(step);
    }

    setWorkflowTemplate(prev => ({
      ...prev,
      steps: updatedSteps
    }));

    setStepDialogOpen(false);
    setSelectedStep(null);
  }, [workflowTemplate.steps]);

  const handleDeleteStep = useCallback((stepId: string) => {
    const updatedSteps = workflowTemplate.steps
      .filter(s => s.id !== stepId)
      .map((step, index) => ({ ...step, order: index + 1 }));

    setWorkflowTemplate(prev => ({
      ...prev,
      steps: updatedSteps
    }));
  }, [workflowTemplate.steps]);

  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const items = Array.from(workflowTemplate.steps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reorderedSteps = items.map((step, index) => ({
      ...step,
      order: index + 1
    }));

    setWorkflowTemplate(prev => ({
      ...prev,
      steps: reorderedSteps
    }));
  }, [workflowTemplate.steps]);

  const validateWorkflow = useCallback(() => {
    const errors: string[] = [];

    if (!workflowTemplate.name.trim()) {
      errors.push('Workflow name is required');
    }

    if (!workflowTemplate.description.trim()) {
      errors.push('Workflow description is required');
    }

    if (!workflowTemplate.category) {
      errors.push('Workflow category is required');
    }

    if (workflowTemplate.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    // Validate step dependencies
    const stepIds = new Set(workflowTemplate.steps.map(s => s.id));
    workflowTemplate.steps.forEach(step => {
      step.dependencies.forEach(depId => {
        if (!stepIds.has(depId)) {
          errors.push(`Step "${step.name}" depends on non-existent step`);
        }
      });
    });

    setValidationErrors(errors);
    return errors.length === 0;
  }, [workflowTemplate]);

  const handleSave = useCallback(() => {
    if (validateWorkflow()) {
      onSave(workflowTemplate);
    }
  }, [workflowTemplate, validateWorkflow, onSave]);

  const handleTest = useCallback(() => {
    if (validateWorkflow() && onTest) {
      onTest(workflowTemplate);
    }
  }, [workflowTemplate, validateWorkflow, onTest]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Workflow Name"
              value={workflowTemplate.name}
              onChange={(e) => setWorkflowTemplate(prev => ({ ...prev, name: e.target.value }))}
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={workflowTemplate.category}
                onChange={(e) => setWorkflowTemplate(prev => ({ ...prev, category: e.target.value }))}
                label="Category"
              >
                {categories.map(category => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={() => setPreviewMode(!previewMode)}
                size="small"
              >
                Preview
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                size="small"
              >
                Save
              </Button>
              {onTest && (
                <Button
                  variant="outlined"
                  startIcon={<PlayIcon />}
                  onClick={handleTest}
                  size="small"
                >
                  Test
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>

        <TextField
          fullWidth
          label="Description"
          value={workflowTemplate.description}
          onChange={(e) => setWorkflowTemplate(prev => ({ ...prev, description: e.target.value }))}
          variant="outlined"
          size="small"
          multiline
          rows={2}
          sx={{ mt: 2 }}
        />
      </Paper>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Validation Errors:</Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Step Palette */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Step Types
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {Object.entries(stepTypeLabels).map(([type, label]) => (
                <Button
                  key={type}
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddStep(type as StepType)}
                  sx={{
                    justifyContent: 'flex-start',
                    borderColor: stepTypeColors[type as StepType],
                    color: stepTypeColors[type as StepType],
                    '&:hover': {
                      borderColor: stepTypeColors[type as StepType],
                      backgroundColor: `${stepTypeColors[type as StepType]}10`
                    }
                  }}
                  size="small"
                >
                  {label}
                </Button>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Workflow Canvas */}
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 2, minHeight: 400 }}>
            <Typography variant="h6" gutterBottom>
              Workflow Steps ({workflowTemplate.steps.length})
            </Typography>

            {workflowTemplate.steps.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 200,
                  border: '2px dashed #ccc',
                  borderRadius: 1,
                  color: 'text.secondary'
                }}
              >
                <Typography>
                  Add steps from the palette to build your workflow
                </Typography>
              </Box>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="workflow-steps">
                  {(provided) => (
                    <Box
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                      {workflowTemplate.steps
                        .sort((a, b) => a.order - b.order)
                        .map((step, index) => (
                          <Draggable key={step.id} draggableId={step.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                sx={{
                                  opacity: snapshot.isDragging ? 0.8 : 1,
                                  transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                                  borderLeft: `4px solid ${stepTypeColors[step.type]}`
                                }}
                              >
                                <CardContent sx={{ pb: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box {...provided.dragHandleProps}>
                                      <DragIcon sx={{ color: 'text.secondary', cursor: 'grab' }} />
                                    </Box>
                                    <Chip
                                      label={stepTypeLabels[step.type]}
                                      size="small"
                                      sx={{
                                        backgroundColor: stepTypeColors[step.type],
                                        color: 'white'
                                      }}
                                    />
                                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                                      {step.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Step {step.order}
                                    </Typography>
                                  </Box>

                                  {step.dependencies.length > 0 && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" color="text.secondary">
                                        Dependencies: {step.dependencies.join(', ')}
                                      </Typography>
                                    </Box>
                                  )}

                                  {previewMode && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        Configuration: {JSON.stringify(step.configuration, null, 2)}
                                      </Typography>
                                    </Box>
                                  )}
                                </CardContent>

                                <CardActions sx={{ pt: 0 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditStep(step)}
                                    color="primary"
                                  >
                                    <EditIcon />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteStep(step.id)}
                                    color="error"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </CardActions>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Step Configuration Dialog */}
      <StepConfigurationDialog
        step={selectedStep}
        open={stepDialogOpen}
        onClose={() => {
          setStepDialogOpen(false);
          setSelectedStep(null);
        }}
        onSave={handleSaveStep}
        availableSteps={workflowTemplate.steps.filter(s => s.id !== selectedStep?.id)}
      />
    </Box>
  );
};

interface StepConfigurationDialogProps {
  step: WorkflowStep | null;
  open: boolean;
  onClose: () => void;
  onSave: (step: WorkflowStep) => void;
  availableSteps: WorkflowStep[];
}

const StepConfigurationDialog: React.FC<StepConfigurationDialogProps> = ({
  step,
  open,
  onClose,
  onSave,
  availableSteps
}) => {
  const [editedStep, setEditedStep] = useState<WorkflowStep | null>(null);

  React.useEffect(() => {
    if (step) {
      setEditedStep({ ...step });
    }
  }, [step]);

  const handleSave = () => {
    if (editedStep) {
      onSave(editedStep);
    }
  };

  if (!editedStep) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Configure {stepTypeLabels[editedStep.type]} Step
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            fullWidth
            label="Step Name"
            value={editedStep.name}
            onChange={(e) => setEditedStep(prev => prev ? { ...prev, name: e.target.value } : null)}
          />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Timeout (ms)"
                type="number"
                value={editedStep.timeout || ''}
                onChange={(e) => setEditedStep(prev => prev ? {
                  ...prev,
                  timeout: e.target.value ? parseInt(e.target.value) : undefined
                } : null)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Retry Count"
                type="number"
                value={editedStep.retryCount || ''}
                onChange={(e) => setEditedStep(prev => prev ? {
                  ...prev,
                  retryCount: e.target.value ? parseInt(e.target.value) : undefined
                } : null)}
              />
            </Grid>
          </Grid>

          <FormControl fullWidth>
            <InputLabel>Dependencies</InputLabel>
            <Select
              multiple
              value={editedStep.dependencies}
              onChange={(e) => setEditedStep(prev => prev ? {
                ...prev,
                dependencies: e.target.value as string[]
              } : null)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const step = availableSteps.find(s => s.id === value);
                    return (
                      <Chip key={value} label={step?.name || value} size="small" />
                    );
                  })}
                </Box>
              )}
            >
              {availableSteps.map((step) => (
                <MenuItem key={step.id} value={step.id}>
                  {step.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          <Typography variant="subtitle1">Step Configuration</Typography>
          <StepConfigurationForm
            stepType={editedStep.type}
            configuration={editedStep.configuration}
            onChange={(config) => setEditedStep(prev => prev ? { ...prev, configuration: config } : null)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

interface StepConfigurationFormProps {
  stepType: StepType;
  configuration: any;
  onChange: (configuration: any) => void;
}

const StepConfigurationForm: React.FC<StepConfigurationFormProps> = ({
  stepType,
  configuration,
  onChange
}) => {
  const updateConfig = (key: string, value: any) => {
    onChange({ ...configuration, [key]: value });
  };

  switch (stepType) {
    case StepType.AI_PROCESSING:
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Model"
            value={configuration.model || ''}
            onChange={(e) => updateConfig('model', e.target.value)}
          />
          <TextField
            fullWidth
            label="Prompt"
            multiline
            rows={3}
            value={configuration.prompt || ''}
            onChange={(e) => updateConfig('prompt', e.target.value)}
          />
        </Box>
      );

    case StepType.EXTERNAL_API_CALL:
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="URL"
            value={configuration.url || ''}
            onChange={(e) => updateConfig('url', e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel>Method</InputLabel>
            <Select
              value={configuration.method || 'GET'}
              onChange={(e) => updateConfig('method', e.target.value)}
            >
              <MenuItem value="GET">GET</MenuItem>
              <MenuItem value="POST">POST</MenuItem>
              <MenuItem value="PUT">PUT</MenuItem>
              <MenuItem value="DELETE">DELETE</MenuItem>
            </Select>
          </FormControl>
        </Box>
      );

    case StepType.CONDITIONAL:
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Condition"
            value={configuration.condition || ''}
            onChange={(e) => updateConfig('condition', e.target.value)}
            helperText="JavaScript expression (e.g., context.data.value > 100)"
          />
          <TextField
            fullWidth
            label="True Action"
            value={configuration.trueAction || ''}
            onChange={(e) => updateConfig('trueAction', e.target.value)}
          />
          <TextField
            fullWidth
            label="False Action"
            value={configuration.falseAction || ''}
            onChange={(e) => updateConfig('falseAction', e.target.value)}
          />
        </Box>
      );

    case StepType.USER_APPROVAL:
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Approvers (comma-separated emails)"
            value={configuration.approvers?.join(', ') || ''}
            onChange={(e) => updateConfig('approvers', e.target.value.split(',').map((s: string) => s.trim()))}
          />
          <TextField
            fullWidth
            label="Message"
            multiline
            rows={2}
            value={configuration.message || ''}
            onChange={(e) => updateConfig('message', e.target.value)}
          />
        </Box>
      );

    case StepType.NOTIFICATION:
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={configuration.type || 'email'}
              onChange={(e) => updateConfig('type', e.target.value)}
            >
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="slack">Slack</MenuItem>
              <MenuItem value="sms">SMS</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Recipients (comma-separated)"
            value={configuration.recipients?.join(', ') || ''}
            onChange={(e) => updateConfig('recipients', e.target.value.split(',').map((s: string) => s.trim()))}
          />
          <TextField
            fullWidth
            label="Message"
            multiline
            rows={3}
            value={configuration.message || ''}
            onChange={(e) => updateConfig('message', e.target.value)}
          />
        </Box>
      );

    case StepType.DATA_TRANSFORMATION:
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Operation"
            value={configuration.operation || ''}
            onChange={(e) => updateConfig('operation', e.target.value)}
          />
          <TextField
            fullWidth
            label="Input Field"
            value={configuration.input || ''}
            onChange={(e) => updateConfig('input', e.target.value)}
          />
          <TextField
            fullWidth
            label="Parameters (JSON)"
            multiline
            rows={3}
            value={JSON.stringify(configuration.parameters || {}, null, 2)}
            onChange={(e) => {
              try {
                updateConfig('parameters', JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, don't update
              }
            }}
          />
        </Box>
      );

    default:
      return (
        <TextField
          fullWidth
          label="Configuration (JSON)"
          multiline
          rows={5}
          value={JSON.stringify(configuration, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, don't update
            }
          }}
        />
      );
  }
};

function getDefaultConfiguration(stepType: StepType): any {
  switch (stepType) {
    case StepType.AI_PROCESSING:
      return { model: 'gpt-3.5-turbo', prompt: '', parameters: {} };
    case StepType.EXTERNAL_API_CALL:
      return { url: '', method: 'GET', headers: {}, data: {} };
    case StepType.CONDITIONAL:
      return { condition: '', trueAction: '', falseAction: '' };
    case StepType.USER_APPROVAL:
      return { approvers: [], message: '', autoApprove: false };
    case StepType.NOTIFICATION:
      return { type: 'email', recipients: [], message: '', template: '' };
    case StepType.DATA_TRANSFORMATION:
      return { operation: '', input: '', parameters: {} };
    default:
      return {};
  }
}

export default WorkflowBuilder;