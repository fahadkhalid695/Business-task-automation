import {
  CalendarRequest,
  CalendarResponse,
  SchedulingConstraints,
  TimeSlot,
  ConflictInfo,
  ExternalIntegration
} from './types/AdministrativeTypes';
import { CalendarEvent, EventStatus, AttendeeStatus } from '../shared/types';
import { logger } from '../shared/utils/logger';
import { CalendarEventModel } from '../shared/models/CalendarEvent';

/**
 * CalendarManager - Handles scheduling, conflict resolution, and meeting coordination
 */
export class CalendarManager {
  private integrations: Map<string, ExternalIntegration>;

  constructor() {
    this.integrations = new Map();
    logger.info('CalendarManager initialized');
  }

  /**
   * Process calendar requests including scheduling, rescheduling, and conflict detection
   */
  async processRequest(request: CalendarRequest): Promise<CalendarResponse> {
    logger.info(`Processing calendar request: ${request.type}`);

    switch (request.type) {
      case 'schedule':
        return await this.scheduleEvent(request);
      case 'reschedule':
        return await this.rescheduleEvent(request);
      case 'cancel':
        return await this.cancelEvent(request);
      case 'find_conflicts':
        return await this.findConflicts(request);
      default:
        throw new Error(`Unsupported calendar request type: ${request.type}`);
    }
  }

  /**
   * Schedule a new calendar event with conflict detection
   */
  private async scheduleEvent(request: CalendarRequest): Promise<CalendarResponse> {
    if (!request.event || !request.constraints) {
      throw new Error('Event details and constraints are required for scheduling');
    }

    const { event, constraints } = request;
    
    try {
      // Find available time slots
      const availableSlots = await this.findAvailableSlots(constraints);
      
      if (availableSlots.length === 0) {
        return {
          success: false,
          message: 'No available time slots found for the requested constraints',
          suggestions: await this.suggestAlternativeSlots(constraints)
        };
      }

      // Use the first available slot
      const selectedSlot = availableSlots[0];
      
      // Create the event
      const newEvent: Partial<CalendarEvent> = {
        ...event,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        status: EventStatus.CONFIRMED,
        attendees: constraints.attendees.map(email => ({
          email,
          name: email.split('@')[0], // Simple name extraction
          status: AttendeeStatus.PENDING,
          isOptional: false
        })),
        location: constraints.location,
        isOnline: constraints.isOnline || false
      };

      // Check for conflicts one more time before saving
      const conflicts = await this.detectConflicts(newEvent as CalendarEvent);
      
      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts,
          message: 'Conflicts detected during final validation',
          suggestions: availableSlots.slice(1, 4) // Suggest next 3 slots
        };
      }

      // Save the event
      const savedEvent = await this.saveEvent(newEvent);

      logger.info(`Event scheduled successfully: ${savedEvent.id}`, {
        title: savedEvent.title,
        startTime: savedEvent.startTime,
        attendees: savedEvent.attendees.length
      });

      return {
        success: true,
        event: savedEvent,
        message: 'Event scheduled successfully'
      };

    } catch (error) {
      logger.error('Event scheduling failed:', error);
      throw error;
    }
  }

  /**
   * Reschedule an existing event
   */
  private async rescheduleEvent(request: CalendarRequest): Promise<CalendarResponse> {
    if (!request.event?.id || !request.constraints) {
      throw new Error('Event ID and new constraints are required for rescheduling');
    }

    try {
      // Find the existing event
      const existingEvent = await CalendarEventModel.findById(request.event.id);
      if (!existingEvent) {
        throw new Error(`Event not found: ${request.event.id}`);
      }

      // Find new available slots
      const availableSlots = await this.findAvailableSlots(request.constraints, request.event.id);
      
      if (availableSlots.length === 0) {
        return {
          success: false,
          message: 'No available time slots found for rescheduling',
          suggestions: await this.suggestAlternativeSlots(request.constraints)
        };
      }

      // Update the event with new time
      const selectedSlot = availableSlots[0];
      existingEvent.startTime = selectedSlot.start;
      existingEvent.endTime = selectedSlot.end;
      existingEvent.updatedAt = new Date();

      // Reset attendee status to pending for rescheduled event
      existingEvent.attendees.forEach(attendee => {
        attendee.status = AttendeeStatus.PENDING;
      });

      const updatedEvent = await existingEvent.save();

      logger.info(`Event rescheduled successfully: ${updatedEvent.id}`, {
        newStartTime: updatedEvent.startTime,
        newEndTime: updatedEvent.endTime
      });

      return {
        success: true,
        event: updatedEvent,
        message: 'Event rescheduled successfully'
      };

    } catch (error) {
      logger.error('Event rescheduling failed:', error);
      throw error;
    }
  }

  /**
   * Cancel an existing event
   */
  private async cancelEvent(request: CalendarRequest): Promise<CalendarResponse> {
    if (!request.event?.id) {
      throw new Error('Event ID is required for cancellation');
    }

    try {
      const event = await CalendarEventModel.findById(request.event.id);
      if (!event) {
        throw new Error(`Event not found: ${request.event.id}`);
      }

      event.status = EventStatus.CANCELLED;
      event.updatedAt = new Date();
      
      const cancelledEvent = await event.save();

      logger.info(`Event cancelled successfully: ${cancelledEvent.id}`);

      return {
        success: true,
        event: cancelledEvent,
        message: 'Event cancelled successfully'
      };

    } catch (error) {
      logger.error('Event cancellation failed:', error);
      throw error;
    }
  }

  /**
   * Find conflicts for a given event or time period
   */
  private async findConflicts(request: CalendarRequest): Promise<CalendarResponse> {
    if (!request.event) {
      throw new Error('Event details are required for conflict detection');
    }

    try {
      const conflicts = await this.detectConflicts(request.event as CalendarEvent);

      return {
        success: true,
        conflicts,
        message: conflicts.length > 0 
          ? `Found ${conflicts.length} conflict(s)` 
          : 'No conflicts detected'
      };

    } catch (error) {
      logger.error('Conflict detection failed:', error);
      throw error;
    }
  }

  /**
   * Find available time slots based on constraints
   */
  private async findAvailableSlots(
    constraints: SchedulingConstraints, 
    excludeEventId?: string
  ): Promise<TimeSlot[]> {
    const { duration, attendees, preferredTimes, excludedTimes, buffer = 15 } = constraints;
    const availableSlots: TimeSlot[] = [];

    // If preferred times are specified, check those first
    if (preferredTimes && preferredTimes.length > 0) {
      for (const slot of preferredTimes) {
        if (await this.isSlotAvailable(slot, attendees, excludeEventId, buffer)) {
          availableSlots.push(slot);
        }
      }
    }

    // If no preferred times or none are available, find general availability
    if (availableSlots.length === 0) {
      const generalSlots = await this.findGeneralAvailability(
        duration, 
        attendees, 
        excludedTimes, 
        excludeEventId, 
        buffer
      );
      availableSlots.push(...generalSlots);
    }

    return availableSlots.slice(0, 10); // Return top 10 slots
  }

  /**
   * Check if a specific time slot is available for all attendees
   */
  private async isSlotAvailable(
    slot: TimeSlot, 
    attendees: string[], 
    excludeEventId?: string,
    buffer: number = 15
  ): Promise<boolean> {
    const bufferMs = buffer * 60 * 1000;
    const startWithBuffer = new Date(slot.start.getTime() - bufferMs);
    const endWithBuffer = new Date(slot.end.getTime() + bufferMs);

    // Check for conflicts with existing events
    const query: any = {
      status: { $ne: EventStatus.CANCELLED },
      $or: [
        {
          startTime: { $lt: endWithBuffer },
          endTime: { $gt: startWithBuffer }
        }
      ],
      'attendees.email': { $in: attendees }
    };

    if (excludeEventId) {
      query._id = { $ne: excludeEventId };
    }

    const conflictingEvents = await CalendarEventModel.find(query);
    
    return conflictingEvents.length === 0;
  }

  /**
   * Find general availability by scanning common business hours
   */
  private async findGeneralAvailability(
    duration: number,
    attendees: string[],
    excludedTimes?: TimeSlot[],
    excludeEventId?: string,
    buffer: number = 15
  ): Promise<TimeSlot[]> {
    const availableSlots: TimeSlot[] = [];
    const durationMs = duration * 60 * 1000;
    
    // Scan next 14 days
    const startDate = new Date();
    startDate.setHours(9, 0, 0, 0); // Start at 9 AM
    
    for (let day = 0; day < 14; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + day);
      
      // Skip weekends (basic implementation)
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        continue;
      }
      
      // Check hourly slots from 9 AM to 5 PM
      for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(currentDate);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart.getTime() + durationMs);
        
        // Don't schedule past 6 PM
        if (slotEnd.getHours() >= 18) {
          break;
        }
        
        const slot: TimeSlot = { start: slotStart, end: slotEnd };
        
        // Check if slot is excluded
        if (excludedTimes && this.isSlotExcluded(slot, excludedTimes)) {
          continue;
        }
        
        // Check availability
        if (await this.isSlotAvailable(slot, attendees, excludeEventId, buffer)) {
          availableSlots.push(slot);
          
          // Limit to 10 slots for performance
          if (availableSlots.length >= 10) {
            return availableSlots;
          }
        }
      }
    }
    
    return availableSlots;
  }

  /**
   * Check if a slot overlaps with excluded times
   */
  private isSlotExcluded(slot: TimeSlot, excludedTimes: TimeSlot[]): boolean {
    return excludedTimes.some(excluded => 
      slot.start < excluded.end && slot.end > excluded.start
    );
  }

  /**
   * Detect conflicts for a given event
   */
  private async detectConflicts(event: CalendarEvent): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    
    // Find overlapping events
    const overlappingEvents = await CalendarEventModel.find({
      _id: { $ne: event.id },
      status: { $ne: EventStatus.CANCELLED },
      startTime: { $lt: event.endTime },
      endTime: { $gt: event.startTime },
      'attendees.email': { $in: event.attendees.map(a => a.email) }
    });

    for (const conflictingEvent of overlappingEvents) {
      const conflictType = this.determineConflictType(event, conflictingEvent);
      const severity = this.determineConflictSeverity(event, conflictingEvent);
      
      conflicts.push({
        conflictingEventId: conflictingEvent.id,
        conflictingEventTitle: conflictingEvent.title,
        conflictType,
        severity,
        resolution: this.suggestConflictResolution(conflictType, severity)
      });
    }

    return conflicts;
  }

  /**
   * Determine the type of conflict between two events
   */
  private determineConflictType(event1: CalendarEvent, event2: CalendarEvent): 'overlap' | 'back_to_back' | 'travel_time' {
    const timeDiff = Math.abs(event1.startTime.getTime() - event2.endTime.getTime());
    const backToBackThreshold = 5 * 60 * 1000; // 5 minutes
    const travelTimeThreshold = 30 * 60 * 1000; // 30 minutes

    if (event1.startTime < event2.endTime && event1.endTime > event2.startTime) {
      return 'overlap';
    } else if (timeDiff <= backToBackThreshold) {
      return 'back_to_back';
    } else if (timeDiff <= travelTimeThreshold && 
               event1.location && event2.location && 
               event1.location !== event2.location) {
      return 'travel_time';
    }

    return 'overlap'; // Default
  }

  /**
   * Determine conflict severity
   */
  private determineConflictSeverity(event1: CalendarEvent, event2: CalendarEvent): 'low' | 'medium' | 'high' {
    const overlapDuration = Math.min(event1.endTime.getTime(), event2.endTime.getTime()) - 
                           Math.max(event1.startTime.getTime(), event2.startTime.getTime());
    
    if (overlapDuration <= 0) return 'low';
    if (overlapDuration <= 30 * 60 * 1000) return 'medium'; // 30 minutes
    return 'high';
  }

  /**
   * Suggest resolution for conflicts
   */
  private suggestConflictResolution(conflictType: string, severity: string): string {
    switch (conflictType) {
      case 'overlap':
        return severity === 'high' 
          ? 'Reschedule one of the events' 
          : 'Consider shortening one event or rescheduling';
      case 'back_to_back':
        return 'Add buffer time between meetings';
      case 'travel_time':
        return 'Allow additional travel time or consider virtual meeting';
      default:
        return 'Review and resolve manually';
    }
  }

  /**
   * Suggest alternative time slots when preferred times are not available
   */
  private async suggestAlternativeSlots(constraints: SchedulingConstraints): Promise<TimeSlot[]> {
    // Expand search criteria for alternatives
    const expandedConstraints = {
      ...constraints,
      preferredTimes: undefined, // Remove preferred times to find any available slots
      buffer: Math.max(5, (constraints.buffer || 15) - 5) // Reduce buffer slightly
    };

    return await this.findAvailableSlots(expandedConstraints);
  }

  /**
   * Save event to database
   */
  private async saveEvent(eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const event = new CalendarEventModel(eventData);
    return await event.save();
  }

  /**
   * Configure external integration
   */
  async configureIntegration(integrationId: string, integration: ExternalIntegration): Promise<void> {
    logger.info(`Configuring calendar integration: ${integration.service}`, { integrationId });
    this.integrations.set(integrationId, integration);
  }

  /**
   * Get health status of calendar manager
   */
  async getHealthStatus(): Promise<any> {
    const eventCount = await CalendarEventModel.countDocuments({ 
      status: { $ne: EventStatus.CANCELLED } 
    });
    
    return {
      status: 'healthy',
      integrations: this.integrations.size,
      activeEvents: eventCount,
      lastProcessed: new Date().toISOString()
    };
  }
}