import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Alert,
  Chip,
  Grid,
  TextField,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Psychology as AIIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Code as CodeIcon,
} from '@mui/icons-material';

interface AIProviderStatus {
  current: 'openai' | 'grok';
  fallback: 'openai' | 'grok';
  health: {
    openai: boolean;
    grok: boolean;
  };
  config: {
    grokApiKey: boolean;
    openaiApiKey: boolean;
  };
}

interface TestResult {
  success: boolean;
  response?: string;
  responseTime?: string;
  error?: string;
}

export const AIProviderSettings: React.FC = () => {
  const [status, setStatus] = useState<AIProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({});
  const [testPrompt, setTestPrompt] = useState('Hello, how are you?');
  const [codeDescription, setCodeDescription] = useState('Create a function to calculate fibonacci numbers');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [generatedCode, setGeneratedCode] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai-provider/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch AI provider status:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchProvider = async (provider: 'openai' | 'grok') => {
    setSwitching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai-provider/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ provider }),
      });
      const data = await response.json();
      
      if (data.success) {
        setAlert({ type: 'success', message: `Successfully switched to ${provider}` });
        await fetchStatus();
      } else {
        setAlert({ type: 'error', message: data.message || 'Failed to switch provider' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to switch AI provider' });
    } finally {
      setSwitching(false);
    }
  };

  const testProvider = async (provider: 'openai' | 'grok') => {
    setTesting(prev => ({ ...prev, [provider]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai-provider/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          prompt: testPrompt,
          provider 
        }),
      });
      const data = await response.json();
      
      setTestResults(prev => ({
        ...prev,
        [provider]: {
          success: data.success,
          response: data.data?.response,
          responseTime: data.data?.responseTime,
          error: data.error || data.message
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [provider]: {
          success: false,
          error: 'Network error'
        }
      }));
    } finally {
      setTesting(prev => ({ ...prev, [provider]: false }));
    }
  };

  const generateCode = async () => {
    setTesting(prev => ({ ...prev, code: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai-provider/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          description: codeDescription,
          language: codeLanguage
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        setGeneratedCode(data.data.code);
        setAlert({ type: 'success', message: `Code generated in ${data.data.responseTime}` });
      } else {
        setAlert({ type: 'error', message: data.message || 'Failed to generate code' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to generate code' });
    } finally {
      setTesting(prev => ({ ...prev, code: false }));
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        AI Provider Settings
      </Typography>
      
      {alert && (
        <Alert severity={alert.type} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {/* Current Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Configuration
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Active Provider:
                </Typography>
                <Chip 
                  label={status?.current?.toUpperCase()} 
                  color="primary" 
                  size="small"
                />
              </Box>
              
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  Fallback Provider:
                </Typography>
                <Chip 
                  label={status?.fallback?.toUpperCase()} 
                  color="secondary" 
                  size="small"
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Provider Health:
              </Typography>
              <Box display="flex" gap={1}>
                <Chip 
                  label={`OpenAI: ${status?.health.openai ? 'Healthy' : 'Unavailable'}`}
                  color={status?.health.openai ? 'success' : 'error'}
                  size="small"
                />
                <Chip 
                  label={`Grok: ${status?.health.grok ? 'Healthy' : 'Unavailable'}`}
                  color={status?.health.grok ? 'success' : 'error'}
                  size="small"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Switch AI Provider
          </Typography>
          
          <FormControl component="fieldset">
            <FormLabel component="legend">Select Primary AI Provider</FormLabel>
            <RadioGroup
              value={status?.current || 'grok'}
              onChange={(e) => switchProvider(e.target.value as 'openai' | 'grok')}
            >
              <FormControlLabel 
                value="grok" 
                control={<Radio />} 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <AIIcon />
                    <Box>
                      <Typography variant="body1">Grok (xAI)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Latest AI model with real-time knowledge and code generation
                      </Typography>
                    </Box>
                    {!status?.config.grokApiKey && (
                      <Chip label="API Key Required" color="warning" size="small" />
                    )}
                  </Box>
                }
                disabled={switching || !status?.config.grokApiKey}
              />
              <FormControlLabel 
                value="openai" 
                control={<Radio />} 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <AIIcon />
                    <Box>
                      <Typography variant="body1">OpenAI</Typography>
                      <Typography variant="caption" color="text.secondary">
                        GPT models for text generation and analysis
                      </Typography>
                    </Box>
                    {!status?.config.openaiApiKey && (
                      <Chip label="API Key Required" color="warning" size="small" />
                    )}
                  </Box>
                }
                disabled={switching || !status?.config.openaiApiKey}
              />
            </RadioGroup>
          </FormControl>
          
          {switching && (
            <Box display="flex" alignItems="center" gap={1} mt={2}>
              <CircularProgress size={20} />
              <Typography variant="body2">Switching provider...</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Testing Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Test AI Providers</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <TextField
              fullWidth
              label="Test Prompt"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              margin="normal"
              helperText="Enter a prompt to test both AI providers"
            />
            
            <Box display="flex" gap={2} mt={2} mb={3}>
              <Button
                variant="outlined"
                onClick={() => testProvider('grok')}
                disabled={testing.grok || !status?.config.grokApiKey}
                startIcon={testing.grok ? <CircularProgress size={20} /> : <SpeedIcon />}
              >
                Test Grok
              </Button>
              <Button
                variant="outlined"
                onClick={() => testProvider('openai')}
                disabled={testing.openai || !status?.config.openaiApiKey}
                startIcon={testing.openai ? <CircularProgress size={20} /> : <SpeedIcon />}
              >
                Test OpenAI
              </Button>
            </Box>
            
            {/* Test Results */}
            {Object.entries(testResults).map(([provider, result]) => (
              <Card key={provider} sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    {provider.toUpperCase()} Test Result
                  </Typography>
                  {result.success ? (
                    <Box>
                      <Typography variant="body2" color="success.main" gutterBottom>
                        ✅ Success ({result.responseTime})
                      </Typography>
                      <Typography variant="body2" sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                        {result.response}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="error.main">
                      ❌ Failed: {result.error}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Code Generation (Grok Feature) */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Code Generation (Grok)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Code Description"
                  value={codeDescription}
                  onChange={(e) => setCodeDescription(e.target.value)}
                  margin="normal"
                  helperText="Describe what code you want to generate"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Programming Language"
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  margin="normal"
                  helperText="e.g., javascript, python, java"
                />
              </Grid>
            </Grid>
            
            <Button
              variant="contained"
              onClick={generateCode}
              disabled={testing.code}
              startIcon={testing.code ? <CircularProgress size={20} /> : <CodeIcon />}
              sx={{ mt: 2, mb: 2 }}
            >
              Generate Code
            </Button>
            
            {generatedCode && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Generated Code:
                </Typography>
                <Box 
                  component="pre" 
                  sx={{ 
                    bgcolor: 'grey.900', 
                    color: 'white', 
                    p: 2, 
                    borderRadius: 1, 
                    overflow: 'auto',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace'
                  }}
                >
                  {generatedCode}
                </Box>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};