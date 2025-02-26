# Todo List for DCISIT Commercial Performance Dashboard

## Backend Development

### Data Import and Validation

- [x] Set up automated Excel/CSV import functionality
- [x] Implement data cleaning and validation
- [x] Create anomaly detection and logging system
- [ ] Develop specific data processing for NGBSS data
- [ ] Implement specific filtering for Corporate data

### KPI Calculation Engine

- [x] Create dynamic KPI calculation system
- [ ] Implement revenue growth calculations
- [ ] Implement invoice processing time metrics
- [ ] Develop Top/Flop performance metrics
- [ ] Set up comparison with objectives and previous year data

### REST API Development

- [x] Create secure authentication endpoints
- [x] Implement user management endpoints
- [ ] Develop KPI data retrieval endpoints
- [ ] Create anomaly detection endpoints
- [ ] Build performance metrics visualization endpoints

### Role-Based Access Control

- [x] Implement user authentication system
- [x] Create role-based permissions
- [x] Set up data access restrictions
- [ ] Configure specific permissions for different DOT departments

## Frontend Development

### Interactive Dashboard Interface

- [x] Create main dashboard layout
- [x] Implement responsive design
- [ ] Develop KPI visualization components
- [ ] Create user-friendly navigation
- [ ] Implement real-time data updates

### Data Visualization

- [x] Implement bar charts for performance metrics
- [x] Create pie charts for data distribution
- [x] Develop line charts for trend analysis
- [ ] Build specialized visualizations for Corporate data
- [ ] Implement comparative visualizations (current vs. objectives)

### Anomaly Notifications

- [ ] Create anomaly detection display
- [ ] Implement notification system for missing invoices
- [ ] Develop alerts for outdated invoices
- [ ] Build anomaly resolution tracking

### Report Export Functionality

- [ ] Implement Excel export functionality
- [ ] Create CSV export capability
- [ ] Develop PDF report generation
- [ ] Build customizable report templates

## Data Processing for Specific NGBSS Data

### Corporate NGBSS Park

- [ ] Implement filtering for customer categories 5 and 57
- [ ] Remove Moohtarif offers and Solutions Hebergements
- [ ] Filter out Predeactivated subscribers
- [ ] Create visualizations by State, Offer Name, Customer Code, etc.
- [ ] Track new creations through Creation Date

### NGBSS Receivables

- [ ] Filter for Specialized Line and LTE products
- [ ] Keep only Corporate and Corporate Group in CUST_LEV1
- [ ] Remove Client professionnelConventionnÃ© from CUST_LEV2
- [ ] Implement receivables tracking by age/year
- [ ] Create visualizations by DOT, client category, and product

### Non-Periodic Revenue (NGBSS)

- [ ] Filter to keep only Siège DO
- [ ] Implement empty cell detection as anomalies
- [ ] Create non-periodic revenue tracking visualizations

### Periodic Revenue (NGBSS)

- [ ] Implement product filtering based on DO
- [ ] Create periodic revenue tracking visualizations
- [ ] Develop anomaly detection for empty cells

### CNT, DNT, RFD Revenue (NGBSS)

- [ ] Implement specific filtering for each revenue type
- [ ] Create visualizations for these special revenue types
- [ ] Develop anomaly detection for empty cells

### Sales Journal (Revenue)

- [ ] Implement Org Name formatting and filtering
- [ ] Create invoice number sorting
- [ ] Develop detection for previous year invoices
- [ ] Implement anomaly detection for special cases
- [ ] Create pivot table functionality

### Invoice and Collection Status

- [ ] Implement name formatting and filtering
- [ ] Create invoice number conversion and sorting
- [ ] Develop duplicate detection for partial collections
- [ ] Create matching with Sales Journal data

## Integration and Automation

- [ ] Integrate all data sources into a unified dashboard
- [ ] Implement automated data refresh
- [ ] Create scheduled reporting
- [ ] Develop user notification system
- [ ] Build performance optimization for large datasets

## Current Progress

The project has made significant progress in establishing the core infrastructure:

### Backend Foundation:

- Authentication system is fully implemented
- User management with role-based access is working
- Basic data import functionality is operational

### Frontend Framework:

- Dashboard layout is complete
- Basic visualization components are implemented
- Responsive design is working across devices

## Next Steps:

- Focus on implementing the specific NGBSS data processing requirements
- Develop the specialized KPI calculations for Corporate performance
- Create the anomaly detection and notification system
- Build the report export functionality

The project is on track for the March 2025 delivery timeline, with the core infrastructure in place. The next phase will focus on implementing the specific business logic for DCISIT's commercial performance tracking.
