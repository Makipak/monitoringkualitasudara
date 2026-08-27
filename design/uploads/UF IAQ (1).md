# UF IAQ – UI/UX Design Prompt

## Project Overview

Design a modern mobile application UI named **UF IAQ**, an **Indoor Air Quality Prediction System** for patient recovery rooms. The application integrates **IoT monitoring**, **Deep Learning prediction**, and **Low-Emission Material principles** to continuously monitor environmental conditions and provide intelligent recommendations that support patient recovery and indoor environmental health.

The design should feel like a professional healthcare technology product that combines the visual clarity of medical applications with the intelligence of smart building monitoring systems.

---

# Design Style

## Design Keywords

- Modern Healthcare
- Clean and Minimalist
- Smart Building Technology
- Professional Dashboard
- Data-Driven Interface
- User-Friendly
- Calm and Trustworthy
- Environmental Monitoring
- Deep Learning Analytics

---

# Color Palette

Use a harmonious combination of **Green and Orange** as the primary identity.

### Primary Colors

- Deep Green (#2E7D32)
- Fresh Green (#4CAF50)
- Soft Green (#E8F5E9)

### Secondary Colors

- Warm Orange (#FF8F00)
- Soft Orange (#FFB74D)
- Light Orange (#FFF3E0)

### Neutral Colors

- White (#FFFFFF)
- Off White (#FAFAF7)
- Light Gray (#F5F5F5)
- Dark Gray (#424242)
- Text Gray (#616161)

---

# Status Color System

### Good / Safe
Green (#4CAF50)

### Slight / Attention
Light Orange (#FFB74D)

### Moderate / Warning
Orange (#FF8F00)

### Serious / Unsafe
Red (#E53935)

---

# Visual Theme

The interface should communicate:

- Healthy indoor environment
- Clean air monitoring
- Patient comfort
- Smart healthcare technology
- Reliable AI prediction

Use:

- Rounded cards (16–24px)
- Soft shadows
- Large typography for critical metrics
- Material Design 3 style
- Smooth spacing
- Modern iconography
- Clean line charts
- Circular gauges
- Status badges
- Responsive mobile layout

Avoid:

- Dark mode concepts
- Neon effects
- Cyberpunk aesthetics
- Overcrowded layouts
- Excessive gradients

---

# Application Structure

The application consists of 4 main navigation sections plus a reusable parameter-detail screen:

1. **Home (Dashboard)**
2. **Prediction**
3. **History**
4. **About**

The Dashboard also provides access to a dedicated **Parameter Detail / Variable Graph** screen for each environmental variable.

The primary navigation should use a bottom navigation bar with four menu items:

- **Home** — dashboard and real-time environmental monitoring
- **Prediction** — Deep Learning prediction and AI analysis
- **History** — historical monitoring data and reports
- **About** — project and developer information

Active menu uses the primary Green color, while Orange is used for secondary actions, highlights, and alerts.

# SCREEN 01 – HOME / DASHBOARD

## Dashboard Scope

The Home / Dashboard screen must **NOT display Deep Learning prediction results, prediction scores, model confidence, predicted values, prediction charts, or AI prediction analysis**.

All prediction-related information must be presented exclusively on the dedicated **Prediction** screen.

The Dashboard should focus only on:

- Real-time environmental monitoring
- Current values of NO₂, CO₂, TVOC, Light, and Noise
- Overall current indoor environmental status
- Environmental trend monitoring
- Smart recommendations based on current sensor conditions
- Low-emission environment indicator
- IoT device and sensor connection status

Do not place a prediction summary card or prediction widget on the Dashboard.


## Header

Title:
UF IAQ

Subtitle:
Indoor Air Quality Prediction System

Top-right:

- Notification Icon
- IoT Connection Status
- Green Connected Indicator

Display:

Last Updated:
14:32:08

---

## Main IAQ Status Card

Large hero card positioned at the top.

Content:

### Indoor Air Quality Status

Current Status:
SAFE

IAQ Score:
82

Prediction:
Safe for Next 30 Minutes

Model Confidence:
94.2%

Visual:

- Circular Gauge
- Green progress ring
- AI Prediction badge
- Soft green background accent

---

## Real-Time Environmental Monitoring

Display the five environmental parameters as **interactive clickable cards**.

The parameter cards must not be static. Each card is a navigation component that opens a dedicated **Parameter Detail / Variable Graph** screen when selected.

### NO₂

Value:
18.4 µg/m³

Status:
Good

Trend indicator

Interaction:
**Clicking the NO₂ card opens the NO₂ Parameter Detail screen.**

---

### CO₂

Value:
780 ppm

Status:
Good

Trend indicator

Interaction:
**Clicking the CO₂ card opens the CO₂ Parameter Detail screen.**

---

### TVOC

Value:
145 ppb

Status:
Attention

Trend indicator

Interaction:
**Clicking the TVOC card opens the TVOC Parameter Detail screen.**

---

### Light

Value:
320 lux

Status:
Good

Trend indicator

Interaction:
**Clicking the Light card opens the Light Parameter Detail screen.**

---

### Noise

Value:
42 dB

Status:
Good

Trend indicator

Interaction:
**Clicking the Noise card opens the Noise Parameter Detail screen.**

---

## Interactive Parameter Card Requirements

Each card includes:

- Parameter icon
- Parameter name
- Current value
- Unit
- Current status badge
- Mini sparkline
- Small arrow / chevron indicating the card is clickable
- Subtle hover/pressed/click feedback
- Green and Orange accent styling

When the user clicks a card, navigate to a dedicated parameter detail screen.

Do not open a generic dashboard modal. The selected variable should have its own focused graph/detail page.

---

# PARAMETER DETAIL / VARIABLE GRAPH SCREEN

Create a reusable detail screen template that dynamically changes based on the selected parameter.

Examples:

- NO₂ → NO₂ Detail
- CO₂ → CO₂ Detail
- TVOC → TVOC Detail
- Light → Light Detail
- Noise → Noise Detail

The page title should automatically display the selected variable.

Example:

**NO₂ Monitoring Detail**

Subtitle:

Historical and Real-Time NO₂ Monitoring

---

## Parameter Summary Card

At the top, show:

Parameter:
NO₂

Current Value:
18.4 µg/m³

Status:
Good

Last Updated:
14:32:08

Trend:
↓ 4.2%

Use a large parameter value and a clear status indicator.

---

## Main Variable Graph

Create a large interactive line chart showing ONLY the selected variable.

For example, when the user clicks NO₂, display:

**NO₂ Concentration Trend**

Y-axis:
NO₂ concentration (µg/m³)

X-axis:
Time

The graph should show the actual sensor data over time.

Do not combine NO₂ with CO₂, TVOC, Light, or Noise on this page.

The graph should support:

- Real-time data
- Historical data
- Zoom
- Tooltip on data points
- Time-based navigation
- Automatic refresh
- Scrollable timeline

---

## Time Range Filter

Provide quick filters:

- 1 Hour
- 6 Hours
- 12 Hours
- 24 Hours
- 7 Days
- Custom

The user can select a custom:

- Date
- Start Time
- End Time

The graph updates according to the selected period.

---

## Threshold / Safety Reference

Display the selected variable's configured threshold range.

Example for NO₂:

Safe Range
[Configured threshold]

Current Value
18.4 µg/m³

Status
Good

Use a horizontal threshold indicator or background reference zone on the graph.

Important:

Do not hard-code health thresholds unless they are supplied by the system's selected standard. Threshold values must be configurable.

---

## Variable Statistics

Display summary cards:

- Current Value
- Average
- Minimum
- Maximum
- Standard Deviation
- Number of Warning Events
- Number of Unsafe Events

These statistics should be calculated from the currently selected time range.

---

## Variable Analysis

Add an analysis card:

### Environmental Analysis

Example:

“NO₂ concentration has remained relatively stable during the selected monitoring period. Current conditions are within the configured safe range.”

The text should be generated dynamically based on the actual data.

---

## Variable Recommendation

If the selected parameter enters an unsafe or warning condition, display:

### Recommended Action

Example:

**NO₂ — Warning**

Recommended actions:

- Improve room ventilation.
- Check potential emission sources.
- Inspect air circulation.
- Evaluate possible indoor emission sources.

If the parameter is safe:

### Current Condition

“The selected parameter is currently within the configured safe range. Continue routine monitoring.”

---

## Parameter Data Table

Below the graph, provide a detailed data table.

Columns:

| Timestamp | Value | Unit | Status |

Example:

| 14:30 | 18.4 | µg/m³ | Good |
| 14:15 | 19.2 | µg/m³ | Good |
| 14:00 | 21.1 | µg/m³ | Good |

Allow:

- Sort by time
- Sort by value
- Pagination
- Export selected parameter data

---

## Export Parameter Report

Add an **Export PDF** button.

The generated report should contain only the selected variable's information:

- Project name: UF IAQ
- Parameter name
- Monitoring period
- Current value
- Average
- Minimum
- Maximum
- Status
- Threshold/reference range
- Trend graph
- Warning/unsafe events
- Environmental analysis
- Recommendations
- Generated date

Example:

If the user selects NO₂, generate a **NO₂ Monitoring Report**, not a report containing all parameters.

---

## Navigation

At the top-left of the parameter detail screen, provide:

**Back to Dashboard**

Also allow navigation between parameters using a compact selector:

- NO₂
- CO₂
- TVOC
- Light
- Noise

The currently selected parameter is highlighted in Green.

Use Orange for secondary actions and selected chart controls.

---

## UX Behavior

The interaction flow should be:

**Home / Dashboard**
↓
**Click Parameter Card**
↓
**Selected Parameter Detail**
↓
**View Variable Graph**
↓
**Filter Time Range**
↓
**View Statistics**
↓
**View Analysis & Recommendation**
↓
**Export Parameter Report**

The interface must clearly communicate that the graph belongs only to the selected variable.

For example:

**Dashboard → NO₂ Card → NO₂ Monitoring Detail → NO₂ Graph**

and:

**Dashboard → CO₂ Card → CO₂ Monitoring Detail → CO₂ Graph**

The same interaction pattern must work consistently for all five parameters.

---

## Environmental Trend

Section title:

Environmental Trend Monitoring

Interactive multi-line chart showing:

- NO₂
- CO₂
- TVOC
- Light
- Noise

Time filters:

- 1 Hour
- 6 Hours
- 12 Hours
- 24 Hours

Selected filter uses orange highlight.

---

## Smart Recommendation Section

Very important section.

Display recommendations dynamically based on environmental conditions.

### Example 1

NO₂ Status:
Unsafe

Recommendation:

- Increase room ventilation.
- Inspect emission sources.
- Check HVAC circulation.
- Evaluate indoor materials producing emissions.

### Example 2

CO₂ Status:
Moderate

Recommendation:

- Improve air circulation.
- Increase fresh air intake.
- Inspect ventilation systems.

### Example 3

TVOC Status:
Unsafe

Recommendation:

- Identify VOC emission sources.
- Improve ventilation.
- Replace materials with low-emission alternatives.
- Reduce chemical-based cleaning products.

### Example 4

Noise Status:
Attention

Recommendation:

- Reduce unnecessary equipment noise.
- Limit high-noise activities.
- Improve acoustic comfort.

### Example 5

Light Status:
Attention

Recommendation:

- Adjust lighting intensity.
- Improve patient comfort.
- Reposition lighting fixtures if necessary.

Use expandable recommendation cards with orange accent borders.

---

## Low-Emission Material Indicator

Card title:

Low-Emission Environment

Content:

Current Status:
Good

Description:

Environmental conditions indicate low VOC exposure and support the use of low-emission materials within the recovery room.

Button:

View Details

Visual:

Leaf icon
Green-orange environmental badge

---

# SCREEN 03 – PREDICTION

## Prediction Screen Scope

The Prediction screen is the **single dedicated location for all Deep Learning prediction features**.

Everything related to prediction must be contained here, including:

- Current IAQ prediction
- Future IAQ prediction
- Predicted values for NO₂, CO₂, TVOC, Light, and Noise
- Prediction horizon
- Model confidence
- Historical vs predicted trends
- Prediction charts
- Model input variables
- AI environmental analysis
- Prediction-based recommendations
- Prediction history shortcut
- Prediction details and interpretation

Do not duplicate these prediction components on the Home / Dashboard screen.


## Purpose

Create a dedicated screen specifically for **Deep Learning-based Indoor Air Quality Prediction**.

This screen should provide a deeper analysis than the Home dashboard. The Home screen only shows a short prediction summary, while this screen contains the complete prediction result, model confidence, predicted trends, input variables, and AI-generated environmental analysis.

---

## Header

Title:

Prediction

Subtitle:

Deep Learning Indoor Air Quality Prediction

Display:

- Current prediction status
- Last prediction update
- IoT data connection status

---

## Prediction Overview Card

Create a large hero card:

### AI Prediction Result

Current IAQ Score:
82

Predicted IAQ Score:
87

Prediction Status:
SAFE

Prediction Horizon:
30 Minutes

Model Confidence:
94.2%

Use a large circular gauge with Green as the dominant color and Orange as an accent.

---

## Predicted Environmental Conditions

Display predicted values for all five variables:

### NO₂

Current:
18.4 µg/m³

Predicted:
17.8 µg/m³

Prediction:
Improving

---

### CO₂

Current:
780 ppm

Predicted:
820 ppm

Prediction:
Slight Increase

---

### TVOC

Current:
145 ppb

Predicted:
132 ppb

Prediction:
Improving

---

### Light

Current:
320 lux

Predicted:
315 lux

Prediction:
Stable

---

### Noise

Current:
42 dB

Predicted:
44 dB

Prediction:
Slight Increase

Use compact cards with Green and Orange indicators.

---

## Prediction Trend Chart

Section title:

AI Predicted Environmental Trend

Create an interactive chart comparing:

- Historical sensor values
- Current sensor values
- Predicted values

Visually distinguish historical data from predicted data.

Time range:

- Next 15 Minutes
- Next 30 Minutes
- Next 1 Hour
- Next 3 Hours

Use Green for actual/current conditions and Orange for predicted values.

---

## Model Confidence

Create a dedicated card:

### Prediction Confidence

94.2%

Display a circular progress indicator or horizontal confidence bar.

Add:

Model Status:
Reliable

Description:

The prediction is generated from real-time IoT sensor data processed through the trained Deep Learning model.

---

## Input Variables

Show the variables currently used by the model:

- NO₂
- CO₂
- TVOC
- Light
- Noise

For each variable display:

- Current value
- Unit
- Trend
- Contribution/importance indicator if available

If feature importance is available from the model, visualize it using horizontal bars.

Do not invent feature importance values if they are not provided by the backend.

---

## AI Environmental Analysis

Create an AI analysis card.

Example:

### AI Analysis

“Based on current environmental conditions, the indoor environment is predicted to remain within the acceptable range over the next 30 minutes. CO₂ shows a slight upward trend, while TVOC is predicted to decrease.”

Use an AI icon and Green/Orange visual accents.

---

## Prediction-Based Recommendation

Display recommendations generated from the prediction result.

Example:

### Recommended Action

CO₂ is predicted to increase.

Recommended actions:

- Monitor room ventilation.
- Check fresh air circulation.
- Inspect HVAC performance if the trend continues.

If all parameters are predicted to remain safe:

### Environment Forecast

“The indoor environment is predicted to remain stable. Continue routine monitoring.”

---

## Prediction History Shortcut

Add a secondary button:

View Prediction History

This opens the relevant historical prediction records in the History screen.

---

# SCREEN 04 – MONITORING HISTORY



## Header

Title:

Monitoring History

Subtitle:

Historical Environmental Monitoring

Action Button:

Export PDF

Orange outlined button.

---

## Filter Panel

Filter components:

### Date Range

- Start Date
- End Date

### Time Range

- Start Time
- End Time

### Year

Dropdown

### Parameter

- All
- NO₂
- CO₂
- TVOC
- Light
- Noise

### Status

- All
- Good
- Attention
- Moderate
- Unsafe

Buttons:

Apply Filter
Reset Filter

Apply button uses Green.
Reset button uses Orange.

---

## Summary Cards

Display:

Average IAQ

Best Condition

Warning Events

Unsafe Events

Monitoring Duration

Cards use green-orange accent styling.

---

## Historical Monitoring Table

Columns:

| Time | NO₂ | CO₂ | TVOC | Light | Noise | IAQ | Status |
|------|-----|-----|------|-------|-------|-----|--------|

Rows include status badges.

Color coded according to environmental condition.

---

## Monitoring Detail View

When a record is selected.

Display:

Timestamp

NO₂ Value

CO₂ Value

TVOC Value

Light Value

Noise Value

IAQ Score

Prediction Result

Model Confidence

Trend Graph

Environmental Analysis

---

## PDF Report Export

Professional report preview screen.

Include:

- Project Name
- Room Name
- Reporting Period
- Device ID
- IAQ Summary
- Average NO₂
- Average CO₂
- Average TVOC
- Average Light
- Average Noise
- Deep Learning Prediction Summary
- Smart Recommendations
- Monitoring Charts
- Generated Date

PDF design should resemble a professional environmental monitoring report.

---

# SCREEN 05 – ABOUT

## Header

Project Profile

---

## Project Introduction

Title:

UF IAQ

Subtitle:

Indoor Air Quality Prediction System for Patient Recovery Rooms

Description:

UF IAQ is an intelligent environmental monitoring platform that combines IoT technology and Deep Learning algorithms to monitor and predict indoor environmental quality in patient recovery rooms. The system provides real-time monitoring, predictive analytics, and actionable recommendations to maintain a healthier and safer recovery environment.

---

## Project Objectives

Display objective cards:

### Real-Time Monitoring

Monitor environmental conditions continuously using IoT devices.

### Deep Learning Prediction

Predict future environmental quality conditions.

### Smart Recommendation

Provide actionable recommendations based on sensor conditions.

### Low-Emission Material Principle

Promote healthy indoor environments through low-emission materials.

### Patient Recovery Support

Improve environmental comfort for patient recovery.

---

## System Technology

Technology cards:

### IoT Sensors

Environmental monitoring devices.

### Deep Learning

Prediction and classification engine.

### Cloud Database

Historical data storage.

### Mobile Application

Monitoring and reporting platform.

---

## System Architecture

Visual flow diagram:

IoT Sensors
↓
Data Acquisition
↓
Data Processing
↓
Deep Learning Model
↓
Prediction Engine
↓
IAQ Classification
↓
Smart Recommendation
↓
Mobile Dashboard

---

## Developer Section

Card layout with profile information.

Fields:

- Developer Name
- Institution
- Study Program
- Supervisor
- Development Year

Additional:

- Institution Logo
- Team Logo
- Contact Email
- GitHub
- Portfolio

---

## Footer

UF IAQ

Indoor Environmental Monitoring & Prediction System

Powered by IoT, Deep Learning, and Low-Emission Material Principles

---

# Design Priority Hierarchy

1. Overall IAQ Status
2. Real-Time Monitoring Values
3. Smart Recommendations
4. AI Prediction
5. Historical Trends and Reports
6. Project Information

The final design should look like a real healthcare-grade environmental monitoring application ready for deployment, combining the trustworthiness of medical systems with the intelligence of AI-powered indoor air quality analytics.
