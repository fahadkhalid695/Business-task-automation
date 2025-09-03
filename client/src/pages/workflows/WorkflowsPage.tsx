import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, Typography } from '@mui/material';

export const WorkflowsPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Workflows - Business Task Automation</title>
      </Helmet>
      
      <Box>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Workflows
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create and manage automation workflows.
        </Typography>
      </Box>
    </>
  );
};