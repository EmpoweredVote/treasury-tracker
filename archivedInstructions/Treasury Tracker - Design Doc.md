## **Epic Feature: Treasury Tracker**

### **Summary**

The **Treasury Tracker** is an interactive data visualization tool designed to help citizens understand and explore how public funds are allocated and spent. Its mission is twofold:

1. To **educate** citizens on public budgeting by making financial data accessible, digestible, and engaging.

2. To **empower** them to “follow their tax dollars” \- seeing where their money goes and what outcomes it supports.

The feature begins with the **municipal budget of Bloomington, Indiana**, serving as a prototype for a scalable system that can later expand to state and federal levels.

The user journey centers on a **horizontal bar visualization** that represents the city’s total annual budget. Each color-coded segment within the bar corresponds to a major department (e.g., Police, Fire, Parks, Transportation). Users can click any segment to **“zoom in”** and reveal a new bar showing how that department’s budget is internally distributed (e.g., salaries, equipment, infrastructure, operations).

Each section also includes **contextual financial information**, offering educational explanations, comparisons, and historical insights that transform raw data into narrative understanding. This design demystifies public finance while fostering transparency, civic confidence, and a sense of shared ownership over community resources.

---

### **Goal**

To make municipal budgeting transparent, understandable, and engaging \- enabling every citizen to visualize how their community allocates funds and how those allocations impact their lives.

### **Hypothesis**

If we make public budgets interactive, educational, and easy to explore, users will gain greater civic literacy, trust their institutions more, and feel more confident engaging in civic discussions or decisions about spending priorities.

---

### **Key Performance Indicators (KPIs)**

* **Engagement Rate:** % of users who interact (click or hover) with at least one section of the budget bar.

* **Depth of Exploration:** Average number of “zoom levels” explored per user session.

* **Understanding Metric:** % of users correctly answering comprehension questions in embedded “Did You Know?” pop-ups or mini-quizzes.

* **Retention / Return Visits:** % of users who revisit the Treasury Tracker within 30 days.

* **Sharing / Discussion Rate:** % of users sharing visualizations or insights via social or local discussion features.

---

### **User Stories**

**1\. Exploring Budgets Visually**  
 *As a user, I want to visually explore how my city spends its budget so that I can quickly understand where major funds go.*  
 **Acceptance Criteria:**

* The platform displays a full horizontal bar representing Bloomington’s total budget.

* Each segment of the bar corresponds to a major department or expenditure category.

* Hovering reveals category names, dollar amounts, and percentages.

* Clicking a segment opens a new horizontal bar beneath it showing that department’s breakdown.

---

**2\. Zooming into Department-Level Spending**  
 *As a user, I want to dive deeper into specific departments to see how their internal budgets are distributed.*  
 **Acceptance Criteria:**

* Users can click on a department (e.g., Police, Parks) to reveal a secondary bar showing subcategories.

* Clicking again can open tertiary layers (e.g., “Equipment” → “Vehicles”).

* The back/zoom-out controls allow seamless navigation between layers.

---

**3\. Learning Through Context**  
 *As a user, I want to understand what each section of the budget means, not just the numbers.*  
 **Acceptance Criteria:**

* Clicking or hovering over a section displays educational panels:

  * “Where the Money Goes” (descriptive text)

  * “Why It Matters” (contextual explanation)

  * “Historical Comparison” (small visual chart or trendline).

* The tone remains nonpartisan, using neutral civic education language.

---

**4\. Comparing Budgets Over Time**  
 *As a user, I want to see how city spending has changed year-over-year.*  
 **Acceptance Criteria:**

* A toggle or slider allows users to view previous fiscal years.

* Percentage change is visually represented with arrows or shading.

* Historical data is cached and attributed to official sources.

---

**5\. Following My Tax Dollars**  
 *As a user, I want to estimate how my personal tax contributions map onto the city’s spending categories.*  
 **Acceptance Criteria:**

* A simple “Enter Your Income” calculator estimates how much of one’s taxes fund each department.

* The tool updates the main bar dynamically to reflect proportional impact.

* All calculations are approximate and clearly labeled as illustrative, not official.

---

### **Potential Tasks**

**Data Collection and Verification**

* Source Bloomington’s most recent public budget in machine-readable form.

* Normalize and categorize data for consistency across departments.

* Implement verification checks and periodic update routines.

**Visualization and Interaction**

* Build horizontal stacked bar components with hover and click interactions.

* Implement smooth zoom-in/zoom-out animations for hierarchy navigation.

* Add tooltips, popovers, and contextual panels with educational text.

**User Interface & Experience**

* Design intuitive navigation and labeling using Empowered.Vote brand colors:

  * **Inform Yellow (\#FED12E)** for educational panels

  * **Muted Blue (\#00657C)** for neutral data areas

  * **Empower Red (\#FF5740)** for callouts or interactive highlights.

* Optimize readability and responsiveness across desktop and mobile devices.

**Educational Layer**

* Write nonpartisan explanations for each budget category.

* Include “Did You Know?” facts and mini-quizzes for civic learning.

* Integrate with **Empowered Badges** for learning progression.

**Data Privacy & Accuracy**

* Use only public, verifiable budget data.

* Avoid storing user income data beyond session context.

**Accessibility**

* Ensure visual contrast ratios and keyboard navigation meet WCAG 2.1 AA standards.

* Provide screen reader compatibility for financial data interpretation.

---

### **Next Steps**

1. **Prototype (Phase 1):**  
    Build a functional prototype for the City of Bloomington budget using a single fiscal year’s data and static educational content.

2. **Usability Testing:**  
    Conduct user testing to assess clarity, comprehension, and engagement.

3. **Dynamic Data Integration:**  
    Connect live data feeds or periodically updated CSVs from municipal sources.

4. **Education Layer Expansion:**  
    Add contextual content, quizzes, and historical comparison modules.

5. **Scaling Plan:**  
    Extend design schema to accommodate state and federal budget datasets for future versions.

6. **Integration Planning:**  
    Prepare groundwork for eventual linkage with Empowered Filing, allowing citizens to explore spending while reviewing their tax payments.

