import type { BudgetCategory } from '../types/budget';

// Color palette
const colors = {
  coral: '#FF5740',
  mutedBlue: '#00657C',
  lightBlue: '#59B0C4',
  yellow: '#FED12E',
  darkBlue: '#004D5C',
  teal: '#008B9C'
};

export const bloomingtonBudget2025: BudgetCategory[] = [
  {
    name: "Police Department",
    amount: 120000000,
    percentage: 24,
    color: colors.mutedBlue,
    description: "The Police Department employs over 300 officers and civilian staff serving Bloomington's 85,000 residents.",
    whyMatters: "Provides 24/7 emergency response, community policing, crime prevention, and investigative services.",
    historicalChange: 3.2,
    subcategories: [
      {
        name: "Salaries",
        amount: 72000000,
        percentage: 60,
        color: colors.mutedBlue,
        description: "Personnel costs for sworn officers, civilian staff, and administrative personnel across all units.",
        subcategories: [
          {
            name: "Patrol Officers",
            amount: 32400000,
            percentage: 45,
            color: colors.mutedBlue,
            description: "Front-line officers responding to calls and conducting patrols"
          },
          {
            name: "Detectives & Investigators",
            amount: 18000000,
            percentage: 25,
            color: colors.lightBlue,
            description: "Specialized units investigating crimes and cold cases"
          },
          {
            name: "Administrative Staff",
            amount: 10800000,
            percentage: 15,
            color: colors.teal,
            description: "Support personnel including dispatchers and records"
          },
          {
            name: "Leadership & Command",
            amount: 7200000,
            percentage: 10,
            color: colors.darkBlue,
            description: "Chiefs, captains, and supervisory personnel"
          },
          {
            name: "Special Units",
            amount: 3600000,
            percentage: 5,
            color: colors.coral,
            description: "K-9, SWAT, and other specialized teams"
          }
        ]
      },
      {
        name: "Equipment",
        amount: 18000000,
        percentage: 15,
        color: colors.lightBlue,
        description: "Vehicles, technology, and gear for officers."
      },
      {
        name: "Training",
        amount: 12000000,
        percentage: 10,
        color: colors.teal,
        description: "Ongoing training and certification programs."
      },
      {
        name: "Transportation",
        amount: 12000000,
        percentage: 10,
        color: colors.yellow,
        description: "Vehicle fleet maintenance and fuel costs."
      },
      {
        name: "Operations & Maintenance",
        amount: 6000000,
        percentage: 5,
        color: colors.coral,
        description: "Facilities, utilities, and daily operational costs."
      }
    ]
  },
  {
    name: "Fire Department",
    amount: 60000000,
    percentage: 12,
    color: colors.coral,
    description: "Emergency response, fire prevention, and community safety services.",
    whyMatters: "Protects lives and property from fires and other emergencies.",
    historicalChange: -1.5,
    subcategories: [
      {
        name: "Salaries",
        amount: 36000000,
        percentage: 60,
        color: colors.mutedBlue,
        description: "Compensation for firefighters and support staff."
      },
      {
        name: "Equipment",
        amount: 9000000,
        percentage: 15,
        color: colors.coral,
        description: "Fire trucks, hoses, and protective gear."
      },
      {
        name: "Training",
        amount: 6000000,
        percentage: 10,
        color: colors.lightBlue,
        description: "Ongoing training and certification programs."
      },
      {
        name: "Operations & Maintenance",
        amount: 9000000,
        percentage: 15,
        color: colors.yellow,
        description: "Station maintenance and daily operations."
      }
    ]
  },
  {
    name: "Parks & Recreation",
    amount: 50000000,
    percentage: 10,
    color: colors.yellow,
    description: "Maintains parks, recreational facilities, and community programs.",
    whyMatters: "Promotes health, wellness, and community engagement.",
    historicalChange: 5.0,
    subcategories: [
      {
        name: "Maintenance",
        amount: 25000000,
        percentage: 50,
        color: colors.mutedBlue,
        description: "Upkeep of parks and facilities."
      },
      {
        name: "Programs",
        amount: 16500000,
        percentage: 33,
        color: colors.coral,
        description: "Youth sports, arts, and senior programs."
      },
      {
        name: "Events",
        amount: 8500000,
        percentage: 17,
        color: colors.yellow,
        description: "Community events and festivals."
      }
    ]
  },
  {
    name: "Transportation",
    amount: 90000000,
    percentage: 18,
    color: colors.lightBlue,
    description: "Manages streets, roads, public transit, and infrastructure.",
    whyMatters: "Ensures safe and efficient movement within the city.",
    historicalChange: 2.1,
    subcategories: [
      {
        name: "Road Maintenance",
        amount: 54000000,
        percentage: 60,
        color: colors.mutedBlue,
        description: "Repair and upkeep of city streets."
      },
      {
        name: "Public Transit",
        amount: 22500000,
        percentage: 25,
        color: colors.coral,
        description: "Bus services and transit infrastructure."
      },
      {
        name: "Infrastructure",
        amount: 13500000,
        percentage: 15,
        color: colors.lightBlue,
        description: "Bridges, sidewalks, and traffic signals."
      }
    ]
  },
  {
    name: "Utilities",
    amount: 100000000,
    percentage: 20,
    color: colors.teal,
    description: "Water, sewer, electric, and waste management services.",
    whyMatters: "Provides essential services for all residents and businesses.",
    historicalChange: 1.2,
    subcategories: [
      {
        name: "Water Services",
        amount: 40000000,
        percentage: 40,
        color: colors.mutedBlue,
        description: "Water treatment and distribution."
      },
      {
        name: "Sewer & Sanitation",
        amount: 35000000,
        percentage: 35,
        color: colors.lightBlue,
        description: "Wastewater treatment and collection."
      },
      {
        name: "Electric",
        amount: 15000000,
        percentage: 15,
        color: colors.yellow,
        description: "Municipal electric utility operations."
      },
      {
        name: "Waste Management",
        amount: 10000000,
        percentage: 10,
        color: colors.coral,
        description: "Trash collection and recycling programs."
      }
    ]
  },
  {
    name: "Administration",
    amount: 80000000,
    percentage: 16,
    color: colors.darkBlue,
    description: "City hall operations, finance, human resources, and general government functions.",
    whyMatters: "Provides governance, oversight, and support services for all city operations.",
    historicalChange: 1.8,
    subcategories: [
      {
        name: "Executive Office",
        amount: 20000000,
        percentage: 25,
        color: colors.mutedBlue,
        description: "Mayor's office and city management."
      },
      {
        name: "Finance & Budget",
        amount: 24000000,
        percentage: 30,
        color: colors.lightBlue,
        description: "Financial management and budgeting."
      },
      {
        name: "Human Resources",
        amount: 16000000,
        percentage: 20,
        color: colors.yellow,
        description: "Employee benefits and recruitment."
      },
      {
        name: "Legal Services",
        amount: 12000000,
        percentage: 15,
        color: colors.coral,
        description: "City attorney and legal support."
      },
      {
        name: "Technology",
        amount: 8000000,
        percentage: 10,
        color: colors.teal,
        description: "IT infrastructure and support."
      }
    ]
  }
];

export const totalBudget2025 = 500000000;
