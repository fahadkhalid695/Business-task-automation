import mongoose, { Schema, Document } from 'mongoose';
import { CalendarEvent as ICalendarEvent, EventStatus, AttendeeStatus } from '../types';

export interface CalendarEventDocument extends ICalendarEvent, Document {}

const calendarEventSchema = new Schema<CalendarEventDocument>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  attendees: [{
    email: { type: String, required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(AttendeeStatus),
      default: AttendeeStatus.PENDING
    },
    isOptional: { type: Boolean, default: false }
  }],
  location: {
    type: String,
    trim: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  meetingUrl: {
    type: String,
    trim: true
  },
  conflictsWith: [{
    type: String
  }],
  status: {
    type: String,
    enum: Object.values(EventStatus),
    default: EventStatus.CONFIRMED
  },
  createdBy: {
    type: String,
    required: true
  },
  recurrence: {
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: { type: Number, default: 1 },
    endDate: Date,
    daysOfWeek: [{ type: Number, min: 0, max: 6 }]
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'popup', 'sms']
    },
    minutesBefore: { type: Number, required: true }
  }],
  externalEventId: {
    type: String
  },
  integrationId: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
calendarEventSchema.index({ startTime: 1 });
calendarEventSchema.index({ endTime: 1 });
calendarEventSchema.index({ createdBy: 1 });
calendarEventSchema.index({ status: 1 });
calendarEventSchema.index({ 'attendees.email': 1 });
calendarEventSchema.index({ externalEventId: 1 });
calendarEventSchema.index({ integrationId: 1 });

// Compound indexes
calendarEventSchema.index({ startTime: 1, endTime: 1 });
calendarEventSchema.index({ createdBy: 1, startTime: 1 });
calendarEventSchema.index({ status: 1, startTime: 1 });

// Pre-save validation
calendarEventSchema.pre('save', function(next) {
  if (this.endTime <= this.startTime) {
    next(new Error('End time must be after start time'));
  }
  next();
});

export const CalendarEventModel = mongoose.model<CalendarEventDocument>('CalendarEvent', calendarEventSchema);