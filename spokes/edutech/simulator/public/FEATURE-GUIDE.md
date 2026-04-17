# AI Proctoring Simulator - Feature Reference Guide

## 🎯 Overview
The AI Proctoring Simulator demonstrates real-time candidate monitoring, violation detection, automated scoring, and cohort analytics for academic proctoring.

---

## 📋 Page-by-Page Guide

### 1. 🏠 Home Page
**URL:** `http://localhost:3105`

**Purpose:** Landing page with workflow overview and quick navigation

**Key Elements:**
- **Feature Cards (6 boxes):** Overview of capabilities
  - Z-Score Calculation: Statistical ranking
  - Real-time Updates: 5-second refresh
  - Control Plane Integration: API connectivity
  - Cohort Analytics: Group statistics
  - Smart Violations: 5 violation types
  - Configurable Scenarios: Conservative/Realistic/Aggressive

- **5-Step Workflow:** Visual guide to the simulation process
- **🚀 Start Simulation Button:** Navigates to Setup page
- **❓ Help Guide Button:** Navigates to interactive help
- **🧪 Run Tests Button:** Navigates to Verification page
- **Quick Stats:** Shows 30 candidates, 5 violation types, 11 tests, infinite scenarios

**What to Check:**
- ✅ All feature cards display correctly
- ✅ Links work for all pages
- ✅ Quick stats show correct numbers
- ✅ Help button accessible from header on all pages

---

## 2. ⚙️ Setup Page
**URL:** `/setup`

**Purpose:** Configure simulation parameters before starting

#### Step 1: Tenant Information
- **Tenant Name input:** Your organization name (e.g., "ACME University")
- **Tenant Email input:** Contact email for tenant

```
What to check:
✅ Both fields are required before proceeding
✅ Email format is validated
✅ Values carry through to session
```

#### Step 2: Batch Selection
**3 Options:**
- 🌅 **Morning Batch** (08:00 AM - 10:00 AM, Hall A)
  - 10 candidates from morning cohort
  
- ☀️ **Afternoon Batch** (02:00 PM - 04:00 PM, Hall B)
  - 10 candidates from afternoon cohort
  
- 🌙 **Evening Batch** (06:00 PM - 08:00 PM, Hall C)
  - 10 candidates from evening cohort

```
What to check:
✅ Each batch loads different candidate names
✅ Time slots are realistic
✅ Batch selection persists in summary
```

#### Step 3: Exam Type
**3 Options:**
- ⚙️ **Engineering** (120 min, Hard difficulty)
- 📊 **Data Science** (90 min, Medium difficulty)
- 🐍 **Python** (90 min, Medium difficulty)

```
What to check:
✅ Exam durations vary by type
✅ Selection updates summary
```

#### Step 4: Violation Scenario
**3 Options:**

1. **🟢 Conservative** (0-2 max violations)
   - Few violations, mostly good behavior
   
2. **🟡 Realistic** (0-8 max violations)
   - Normal exam conditions with mix of behaviors
   
3. **🔴 Aggressive** (0-15 max violations)
   - Many violations, challenging behavior

```
What to check:
✅ Max violations field updates
✅ Summary shows selection
```

#### Submit Button
- 🚀 **Start Simulation:** Creates 10 candidates, initializes scoring

```
What to check:
✅ Button disabled until all fields filled
✅ Loading state shows during init
✅ Redirects to Exam Monitor on success
```

---

## 3. 📊 Exam Monitor Page
**URL:** `/exam-monitor`

**Purpose:** Real-time candidate monitoring with violation injection

#### Candidate Grid (5×2 = 10 cards)

Each **Candidate Card** shows:
- **Name:** Candidate's full name
- **Score:** 0-100, decreases with violations
- **Z-Score:** Statistical deviation from cohort mean
- **Percentile:** Rank within cohort (0-100%)
- **Violations:** Count of detected violations
- **Progress Bar:** Visual score representation
- **Status Icon:**
  - ✅ Active (Green)
  - ⏸️ Paused (Yellow)
  - 🔒 Locked (Red)
  - 🛑 Terminated (Dark Red)

**Color Coding:**
- 🟢 Green: Score 85-100 (Excellent)
- 🟡 Yellow: Score 65-85 (Good)
- 🟠 Orange: Score 45-65 (Average)
- 🔴 Red: Score 0-45 (High Risk/Critical)

#### Controls

**Auto-Refresh Toggle:**
- ⏱️ ON: Scores update every 5 seconds automatically
- ⏱️ OFF: Manual refresh only

#### Violation Injector Modal

**Fields:**
1. **Candidate Selector:** Dropdown of 10 candidates
2. **Violation Type (5 types):**
   - 👁️ Eye Contact Loss (Weight: 2)
   - 🔄 Tab Switching (Weight: 3)
   - 🔊 Audio Detection (Weight: 4)
   - 📺 Screen Share (Weight: 5)
   - 🚶 Excessive Movement (Weight: 1)

3. **Severity Selector:**
   - 👀 Watch (0.5x impact)
   - ⚠️ Warning (1.0x impact)
   - 🚨 Critical (1.5x impact)

4. **Expected Outcome:** Shows score change prediction

**Auto-Escalation Thresholds:**
- Lock at Z-score ≤ -2.0
- Pause at Z-score ≤ -1.5
- Flag at Z-score ≤ -1.0

#### Summary Stats (Bottom)

Shows cohort breakdown:
- 🟢 **Excellent:** High performers
- 🟡 **Good:** Above average
- 🟠 **Average:** Middle performers
- 🔴 **High Risk:** Below average
- 🚨 **Critical:** Very low performers

---

## 4. ⚙️ Admin Dashboard
**URL:** `/admin-dashboard`

**Purpose:** Batch operations on multiple candidates

#### High-Risk Alert Banner
- Shows candidates in critical condition
- Red background highlighting

#### Batch Action Controls

**Multi-Select:** Choose individual candidates or "Select All"

**Lock Duration:** 5-240 minutes

**Action Buttons:**

1. **🔒 Lock Candidates**
   - Prevents exam continuation
   - Auto-unlock after duration expires
   - Status: "Locked"

2. **⏸️ Pause Candidates**
   - Freezes scoring temporarily
   - Can resume later
   - No time penalty

3. **▶️ Resume Candidates**
   - Resumes from paused state
   - Returns to active testing

4. **🚩 Flag Candidates**
   - Marks for manual review
   - Adds alert banner
   - Exam continues

5. **🛑 Terminate Candidates**
   - Ends exam immediately
   - Final score locked
   - Cannot resume

#### Candidate Table

Shows all 10:
- Name | Score | Z-Score | Violations | Status | Risk

---

## 5. 📈 Analytics Page
**URL:** `/analytics`

**Purpose:** Cohort statistics and visualization

#### KPI Cards

1. **Mean Score:** Average across all candidates
2. **Standard Deviation:** Score spread/variation
3. **Total Violations:** Sum across cohort
4. **Alerts Triggered:** Count of automated alerts

#### Charts

- **Risk Distribution:** Bar chart of candidates by risk level
- **Violations by Type:** Breakdown of violation types
- **Sorted Table:** Top 10 candidates by score

---

## 6. ✅ Verification Page
**URL:** `/verification`

**Purpose:** E2E testing to validate system

#### 11-Test Suite

1. Session Initialized
2. Batch Created (10 candidates)
3. Score Calculation Valid (0-100)
4. Z-Score Computation
5. Risk Level Classification
6. Percentile Calculation
7. Simulation Context Valid
8. Data Persistence
9. Adaptive Weights Initialized
10. Alert System Ready
11. Complete Workflow

#### Execution

- Click 🧪 "Run All Tests"
- See progress: X/11, percentage, duration
- Results: ✅ PASS, ❌ FAIL, ⏳ RUNNING
- Summary: % passing

---

## ❓ Help Resources Available

### Within the App:
1. **❓ Help Button** in header - accessible from all pages
2. **Interactive Help Page** (/help) - click any topic to learn more
3. **Feature Cards** - brief descriptions on home page

### External:
1. **Feature Guide** (FEATURE-GUIDE.md) - comprehensive offline reference
2. **Button-Level Tooltips** - hover over buttons for quick tips
3. **Workflow Guides** - step-by-step examples in help

---

## 🔧 Violation Impact Calculator

### Score Change Formula
```
New Score = 100 - (Violations × Weight × Severity Multiplier)
```

### Example
- Base Score: 100
- 1 Tab Switching violation (weight 3) at Critical (1.5x)
- Calculation: 100 - (1 × 3 × 1.5) = 95.5
- New Score: 95

---

## 📊 Z-Score & Percentile

### Z-Score Ranges
- ≥ 1.5: Excellent (🟢)
- 0.5 to 1.5: Good (🟡)
- -0.5 to 0.5: Average (🟠)
- -1.5 to -0.5: High-Risk (🔴)
- < -1.5: Critical (🚨)

### Percentile
- 95th = Top 5%
- 50th = Median
- 5th = Bottom 5%

---

**Last Updated:** April 8, 2026 | **Version:** 0.1.0
