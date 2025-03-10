import React, { useState, useEffect, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { createEventId } from "./event-utils";
import "./Calendar.css";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Alert,
  Snackbar,
  Paper,
  useTheme,
  useMediaQuery,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Grid,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Event as EventIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  CalendarMonth as CalendarIcon,
} from "@mui/icons-material";
import PageLayout from "../../components/PageLayout";

// Local storage keys
const EVENTS_STORAGE_KEY = "calendar_events";
const WEEKENDS_VISIBLE_KEY = "calendar_weekends_visible";
const CALENDAR_VIEW_KEY = "calendar_current_view";

// Alert severity types
const SEVERITY = {
  SUCCESS: "success",
  ERROR: "error",
  INFO: "info",
  WARNING: "warning",
};

export default function Calendar() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  // State management
  const [weekendsVisible, setWeekendsVisible] = useState(() => {
    const saved = localStorage.getItem(WEEKENDS_VISIBLE_KEY);
    return saved ? JSON.parse(saved) : true;
  });

  const [currentView, setCurrentView] = useState(() => {
    const saved = localStorage.getItem(CALENDAR_VIEW_KEY);
    return saved || (isMobile ? "listWeek" : "dayGridMonth");
  });

  const [currentEvents, setCurrentEvents] = useState(() => {
    const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [activeCategories, setActiveCategories] = useState([]);

  const [eventForm, setEventForm] = useState({
    title: "",
    start: "",
    end: "",
    allDay: false,
    location: "",
    description: "",
    color: "#3788d8",
    category: "general",
  });

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dialogMode, setDialogMode] = useState("add");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: SEVERITY.SUCCESS,
  });

  // Event categories
  const eventCategories = useMemo(
    () => [
      {
        value: "general",
        label: t("calendar.categories.general"),
        color: "#3788d8",
      },
      {
        value: "meeting",
        label: t("calendar.categories.meeting"),
        color: "#e67c73",
      },
      { value: "task", label: t("calendar.categories.task"), color: "#33b679" },
      {
        value: "reminder",
        label: t("calendar.categories.reminder"),
        color: "#8e24aa",
      },
      {
        value: "personal",
        label: t("calendar.categories.personal") || "Personal",
        color: "#f6bf26",
      },
    ],
    [t]
  );

  // Track events
  const handleEvents = useCallback(
    (events) => {
      const formattedEvents = events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startStr,
        end: event.endStr,
        allDay: event.allDay,
        backgroundColor: event.backgroundColor,
        extendedProps: event.extendedProps,
      }));

      // Only update if events have actually changed
      if (JSON.stringify(formattedEvents) !== JSON.stringify(currentEvents)) {
        setCurrentEvents(formattedEvents);
      }
    },
    [currentEvents]
  );

  // Save events to local storage whenever they change
  useEffect(() => {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(currentEvents));
  }, [currentEvents]);

  // Save weekends visibility to local storage
  useEffect(() => {
    localStorage.setItem(WEEKENDS_VISIBLE_KEY, JSON.stringify(weekendsVisible));
  }, [weekendsVisible]);

  // Save current view to local storage
  useEffect(() => {
    localStorage.setItem(CALENDAR_VIEW_KEY, currentView);
  }, [currentView]);

  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Initialize active categories on first load
  useEffect(() => {
    if (activeCategories.length === 0 && eventCategories.length > 0) {
      setActiveCategories(eventCategories.map((cat) => cat.value));
    }
  }, [eventCategories, activeCategories.length]);

  // Filtered events based on active categories
  const filteredEvents = useMemo(() => {
    return currentEvents.filter((event) =>
      activeCategories.includes(event.extendedProps?.category || "general")
    );
  }, [currentEvents, activeCategories]);

  // Group events by category for the sidebar
  const eventsByCategory = useMemo(() => {
    const grouped = {};
    eventCategories.forEach((cat) => {
      grouped[cat.value] = currentEvents.filter(
        (event) => event.extendedProps?.category === cat.value
      );
    });
    return grouped;
  }, [currentEvents, eventCategories]);

  // Sort upcoming events
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter((event) => new Date(event.start) >= now)
      .sort((a, b) => {
        const dateA = new Date(a.start).getTime();
        const dateB = new Date(b.start).getTime();
        return dateA - dateB;
      })
      .slice(0, 5);
  }, [filteredEvents]);

  // Handle view change
  const handleViewChange = useCallback((newView) => {
    setCurrentView(newView);
  }, []);

  // Handle weekends toggle
  const handleWeekendsToggle = useCallback(() => {
    setWeekendsVisible(!weekendsVisible);
  }, [weekendsVisible]);

  // Handle date selection
  const handleDateSelect = useCallback((selectInfo) => {
    setDialogMode("add");
    setEventForm({
      title: "",
      start: selectInfo.startStr,
      end: selectInfo.endStr,
      allDay: selectInfo.allDay,
      location: "",
      description: "",
      color: getCategoryColor("general"),
      category: "general",
    });
    setOpenDialog(true);
  }, []);

  // Get color for category
  const getCategoryColor = useCallback(
    (categoryValue) => {
      const category = eventCategories.find(
        (cat) => cat.value === categoryValue
      );
      return category ? category.color : "#3788d8";
    },
    [eventCategories]
  );

  // Handle event click
  const handleEventClick = useCallback((clickInfo) => {
    setDialogMode("edit");
    setSelectedEvent(clickInfo.event);

    // Extract event data
    const eventData = {
      title: clickInfo.event.title,
      start: clickInfo.event.startStr,
      end: clickInfo.event.endStr,
      allDay: clickInfo.event.allDay,
      location: clickInfo.event.extendedProps.location || "",
      description: clickInfo.event.extendedProps.description || "",
      color: clickInfo.event.backgroundColor || "#3788d8",
      category: clickInfo.event.extendedProps.category || "general",
    };

    setEventForm(eventData);
    setOpenDialog(true);
  }, []);

  // Handle dialog close
  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedEvent(null);
    setEventForm({
      title: "",
      start: "",
      end: "",
      allDay: false,
      location: "",
      description: "",
      color: "#3788d8",
      category: "general",
    });
  }, []);

  // Handle form input changes
  const handleInputChange = useCallback(
    (e) => {
      const { name, value, checked } = e.target;

      setEventForm((prev) => {
        const updatedForm = {
          ...prev,
          [name]: name === "allDay" ? checked : value,
        };

        // Auto-update color when category changes
        if (name === "category") {
          updatedForm.color = getCategoryColor(value);
        }

        return updatedForm;
      });
    },
    [getCategoryColor]
  );

  // Save event
  const handleSaveEvent = useCallback(() => {
    if (!eventForm.title.trim()) {
      setSnackbar({
        open: true,
        message: t("calendar.titleRequired"),
        severity: SEVERITY.ERROR,
      });
      return;
    }

    const eventData = {
      id: dialogMode === "add" ? createEventId() : selectedEvent.id,
      title: eventForm.title,
      start: eventForm.start,
      end: eventForm.end,
      allDay: eventForm.allDay,
      backgroundColor: eventForm.color,
      extendedProps: {
        location: eventForm.location,
        description: eventForm.description,
        category: eventForm.category,
      },
    };

    if (dialogMode === "add") {
      setCurrentEvents((prev) => [...prev, eventData]);
      setSnackbar({
        open: true,
        message: t("calendar.eventAdded"),
        severity: SEVERITY.SUCCESS,
      });
    } else {
      setCurrentEvents((prev) =>
        prev.map((event) => (event.id === eventData.id ? eventData : event))
      );
      setSnackbar({
        open: true,
        message: t("calendar.eventUpdated"),
        severity: SEVERITY.SUCCESS,
      });
    }

    handleCloseDialog();
  }, [dialogMode, eventForm, selectedEvent, t, handleCloseDialog]);

  // Delete event
  const handleDeleteEvent = useCallback(() => {
    if (selectedEvent && window.confirm(t("calendar.deleteConfirmation"))) {
      setCurrentEvents((prev) =>
        prev.filter((event) => event.id !== selectedEvent.id)
      );
      setSnackbar({
        open: true,
        message: t("calendar.eventDeleted"),
        severity: SEVERITY.INFO,
      });
      handleCloseDialog();
    }
  }, [selectedEvent, t, handleCloseDialog]);

  // Toggle category filter
  const handleCategoryToggle = useCallback((category) => {
    setActiveCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((cat) => cat !== category);
      } else {
        return [...prev, category];
      }
    });
  }, []);

  // Quick add event
  const handleQuickAddEvent = useCallback(() => {
    const now = new Date();
    handleDateSelect({
      startStr: now.toISOString(),
      endStr: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
    });
  }, [handleDateSelect]);

  // Calculate calendar height based on screen size
  const calendarHeight = useMemo(() => {
    if (isMobile) return "auto";
    return "calc(100vh - 200px)";
  }, [isMobile]);

  // Render event content
  const renderEventContent = useCallback(
    (eventInfo) => {
      const category = eventInfo.event.extendedProps?.category || "general";
      const categoryLabel =
        eventCategories.find((cat) => cat.value === category)?.label ||
        category;

      return (
        <Box
          sx={{
            p: 0.5,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <Typography variant="subtitle2" noWrap fontWeight="bold">
            {eventInfo.event.title}
          </Typography>
          {!isMobile && eventInfo.event.extendedProps.location && (
            <Typography variant="caption" display="block" noWrap>
              📍 {eventInfo.event.extendedProps.location}
            </Typography>
          )}
          {!isMobile && !eventInfo.view.type.includes("list") && (
            <Typography
              variant="caption"
              display="block"
              noWrap
              sx={{ opacity: 0.7 }}
            >
              {categoryLabel}
            </Typography>
          )}
        </Box>
      );
    },
    [eventCategories, isMobile]
  );

  // Sidebar content
  const sidebarContent = (
    <Paper
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 0,
        boxShadow: isMobile ? 1 : 0,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6">
          <CalendarIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          {t("calendar.myEvents")}
        </Typography>
        {isMobile && (
          <IconButton onClick={() => setSidebarOpen(false)}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <Button
        variant="contained"
        fullWidth
        startIcon={<AddIcon />}
        onClick={handleQuickAddEvent}
        sx={{ mb: 2 }}
      >
        {t("calendar.quickAdd")}
      </Button>

      <Divider sx={{ my: 2 }}>
        <Chip
          label={t("calendar.categories.title") || "Categories"}
          size="small"
        />
      </Divider>

      <Box sx={{ mb: 2 }}>
        {eventCategories.map((category) => (
          <FormControlLabel
            key={category.value}
            control={
              <Checkbox
                checked={activeCategories.includes(category.value)}
                onChange={() => handleCategoryToggle(category.value)}
                sx={{
                  color: category.color,
                  "&.Mui-checked": {
                    color: category.color,
                  },
                }}
              />
            }
            label={
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                {category.label}
                <Chip
                  size="small"
                  label={eventsByCategory[category.value]?.length || 0}
                  sx={{ ml: 1, backgroundColor: `${category.color}20` }}
                />
              </Box>
            }
            sx={{ width: "100%" }}
          />
        ))}
      </Box>

      <Divider sx={{ my: 2 }}>
        <Chip label={t("calendar.upcoming") || "Upcoming"} size="small" />
      </Divider>

      <List sx={{ flexGrow: 1, overflow: "auto" }}>
        {upcomingEvents.map((event) => (
          <ListItem
            key={event.id}
            divider
            sx={{
              cursor: "pointer",
              "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
              borderLeft: `4px solid ${event.backgroundColor}`,
              pl: 2,
            }}
            onClick={() => {
              const fakeEvent = {
                event: { ...event, extendedProps: event.extendedProps },
              };
              handleEventClick(fakeEvent);
            }}
          >
            <ListItemText
              primary={event.title}
              secondary={
                <>
                  <Typography variant="caption" display="block">
                    {new Date(event.start).toLocaleDateString()}{" "}
                    {!event.allDay &&
                      new Date(event.start).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </Typography>
                  {event.extendedProps.location && (
                    <Typography variant="caption" display="block">
                      📍 {event.extendedProps.location}
                    </Typography>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
        {filteredEvents.filter((event) => new Date(event.start) >= new Date())
          .length === 0 && (
          <ListItem>
            <ListItemText
              primary={t("calendar.noUpcomingEvents")}
              secondary={t("calendar.addSomeEvents")}
            />
          </ListItem>
        )}
      </List>
    </Paper>
  );

  // Header actions
  const headerAction = (
    <Box
      sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}
    >
      {isMobile ? (
        <>
          <IconButton
            color="primary"
            onClick={() => setSidebarOpen(true)}
            sx={{ border: `1px solid ${theme.palette.primary.main}` }}
          >
            <EventIcon />
          </IconButton>
          <IconButton
            color="primary"
            onClick={() => setFilterDrawerOpen(true)}
            sx={{ border: `1px solid ${theme.palette.primary.main}` }}
          >
            <FilterListIcon />
          </IconButton>
        </>
      ) : (
        <>
          <FormControlLabel
            control={
              <Checkbox
                checked={weekendsVisible}
                onChange={handleWeekendsToggle}
              />
            }
            label={t("calendar.showWeekends")}
          />
        </>
      )}
      <Button
        variant={isMobile ? "outlined" : "contained"}
        color="primary"
        onClick={handleQuickAddEvent}
        startIcon={<AddIcon />}
        size={isMobile ? "small" : "medium"}
      >
        {isMobile ? "" : t("calendar.addEvent")}
      </Button>
    </Box>
  );

  return (
    <PageLayout
      title={t("common.calendar")}
      subtitle={t("calendar.manageEvents")}
      headerAction={headerAction}
    >
      <Box sx={{ display: "flex", height: calendarHeight, overflow: "hidden" }}>
        {/* Sidebar - show directly on desktop, use drawer on mobile */}
        {!isMobile && (
          <Box
            sx={{
              width: 280,
              flexShrink: 0,
              display: sidebarOpen ? "block" : "none",
            }}
          >
            {sidebarContent}
          </Box>
        )}

        {/* Mobile drawer for sidebar */}
        <Drawer
          anchor="left"
          open={isMobile && sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: 280 } }}
        >
          {sidebarContent}
        </Drawer>

        {/* Mobile drawer for filters */}
        <Drawer
          anchor="bottom"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          PaperProps={{
            sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
          }}
        >
          <Box sx={{ p: 2, maxHeight: "50vh" }}>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
            >
              <Typography variant="h6">{t("calendar.filters")}</Typography>
              <IconButton onClick={() => setFilterDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={weekendsVisible}
                  onChange={handleWeekendsToggle}
                />
              }
              label={t("calendar.showWeekends")}
            />

            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
              {t("calendar.categories.title") || "Categories"}
            </Typography>

            <Grid container spacing={1}>
              {eventCategories.map((category) => (
                <Grid item xs={6} key={category.value}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={activeCategories.includes(category.value)}
                        onChange={() => handleCategoryToggle(category.value)}
                        sx={{
                          color: category.color,
                          "&.Mui-checked": {
                            color: category.color,
                          },
                        }}
                      />
                    }
                    label={category.label}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Drawer>

        {/* Main calendar area */}
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <Paper sx={{ height: "100%", p: { xs: 1, sm: 2 }, borderRadius: 0 }}>
            <FullCalendar
              plugins={[
                dayGridPlugin,
                timeGridPlugin,
                interactionPlugin,
                listPlugin,
              ]}
              initialView={currentView}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: isMobile
                  ? "dayGridMonth,listWeek"
                  : "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
              }}
              buttonText={{
                today: t("calendar.today"),
                month: isMobile
                  ? t("calendar.monthShort") || "M"
                  : t("calendar.month"),
                week: isMobile
                  ? t("calendar.weekShort") || "W"
                  : t("calendar.week"),
                day: isMobile
                  ? t("calendar.dayShort") || "D"
                  : t("calendar.day"),
                list: isMobile
                  ? t("calendar.listShort") || "L"
                  : t("calendar.list"),
              }}
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={isMobile ? 2 : true}
              weekends={weekendsVisible}
              events={filteredEvents}
              select={handleDateSelect}
              eventContent={renderEventContent}
              eventClick={handleEventClick}
              eventsSet={handleEvents}
              height="100%"
              viewDidMount={(info) => handleViewChange(info.view.type)}
              windowResize={(info) => {
                if (isMobile && !currentView.includes("list")) {
                  info.view.calendar.changeView("listWeek");
                }
              }}
              eventTimeFormat={{
                hour: "numeric",
                minute: "2-digit",
                meridiem: "short",
              }}
              stickyHeaderDates={true}
              firstDay={1} // Week starts on Monday
              navLinks={true} // Allow clicking on day/week names to navigate views
              nowIndicator={true} // Show an indicator for the current time
            />
          </Paper>
        </Box>
      </Box>

      {/* Event dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            pb: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            {dialogMode === "add"
              ? t("calendar.addEvent")
              : t("calendar.editEvent")}
          </Box>
          {isMobile && (
            <IconButton onClick={handleCloseDialog}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>

        <DialogContent dividers>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              my: isMobile ? 1 : 0,
            }}
          >
            <TextField
              name="title"
              label={t("calendar.eventTitle")}
              value={eventForm.title}
              onChange={handleInputChange}
              fullWidth
              required
              error={!eventForm.title.trim()}
              helperText={
                !eventForm.title.trim() && t("calendar.titleRequired")
              }
            />

            <FormControl fullWidth>
              <InputLabel>{t("calendar.category")}</InputLabel>
              <Select
                name="category"
                value={eventForm.category}
                onChange={handleInputChange}
                label={t("calendar.category")}
              >
                {eventCategories.map((category) => (
                  <MenuItem
                    key={category.value}
                    value={category.value}
                    sx={{ color: category.color }}
                  >
                    {category.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              name="description"
              label={t("calendar.eventDescription")}
              value={eventForm.description}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={3}
            />

            <TextField
              name="location"
              label={t("calendar.location")}
              value={eventForm.location}
              onChange={handleInputChange}
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  name="allDay"
                  checked={eventForm.allDay}
                  onChange={handleInputChange}
                />
              }
              label={t("calendar.allDay")}
            />

            {!eventForm.allDay && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="start"
                    label={t("calendar.startTime")}
                    type="datetime-local"
                    value={eventForm.start}
                    onChange={handleInputChange}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="end"
                    label={t("calendar.endTime")}
                    type="datetime-local"
                    value={eventForm.end}
                    onChange={handleInputChange}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
              </Grid>
            )}

            <TextField
              name="color"
              label={t("calendar.eventColor")}
              type="color"
              value={eventForm.color}
              onChange={handleInputChange}
              fullWidth
              sx={{ "& input": { height: 40 } }}
            />
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: isMobile ? 2 : 1,
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
          }}
        >
          {dialogMode === "edit" && (
            <Button
              onClick={handleDeleteEvent}
              color="error"
              variant={isMobile ? "outlined" : "text"}
              startIcon={<DeleteIcon />}
              sx={{
                mr: isMobile ? 0 : "auto",
                mb: isMobile ? 1 : 0,
                order: isMobile ? 3 : 0,
              }}
              fullWidth={isMobile}
            >
              {t("common.delete")}
            </Button>
          )}
          <Box
            sx={{
              display: "flex",
              gap: 1,
              width: isMobile ? "100%" : "auto",
              flexDirection: isMobile ? "column-reverse" : "row",
            }}
          >
            <Button
              onClick={handleCloseDialog}
              fullWidth={isMobile}
              variant={isMobile ? "outlined" : "text"}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveEvent}
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              fullWidth={isMobile}
            >
              {dialogMode === "add" ? t("common.add") : t("common.save")}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
}
