import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
} from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';

export const NotFoundPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Page Not Found - Business Task Automation</title>
      </Helmet>

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Container maxWidth="sm">
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: '6rem',
                  fontWeight: 'bold',
                  color: 'primary.main',
                  mb: 2,
                }}
              >
                404
              </Typography>
              
              <Typography variant="h4" gutterBottom>
                Page Not Found
              </Typography>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                The page you're looking for doesn't exist or has been moved.
              </Typography>
              
              <Button
                component={RouterLink}
                to="/dashboard"
                variant="contained"
                size="large"
                startIcon={<HomeIcon />}
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </>
  );
};