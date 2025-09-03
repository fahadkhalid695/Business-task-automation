import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Box, Typography } from '@mui/material';

export const IntegrationsPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Integrations - Business Task Automation</title>
      </Helmet>
      
      <Box>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Integrations
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Connect and manage external services.
        </Typography>
      </Box>
    </>
  );
};