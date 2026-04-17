export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface QuizConfig {
  id: string;
  title: string;
  description: string;
  timeLimit: number; // in seconds
  passingScore: number; // percentage
  questions: QuizQuestion[];
}

export const FINANCIAL_LITERACY_QUIZ: QuizConfig = {
  id: 'fin_lit_2026',
  title: 'Financial Literacy Challenge 2026',
  description: 'Test your understanding of basic financial concepts and principles',
  timeLimit: 900, // 15 minutes
  passingScore: 70,
  questions: [
    {
      id: 1,
      question: 'What is compound interest?',
      options: [
        'Interest paid only on the principal amount',
        'Interest paid on both principal and previously earned interest',
        'A type of bank account',
        'A penalty for late payments'
      ],
      correctAnswer: 1,
      explanation: 'Compound interest is earned on both the original principal and previously earned interest, creating exponential growth over time.'
    },
    {
      id: 2,
      question: 'Which of the following is NOT a good strategy for building an emergency fund?',
      options: [
        'Saving 3-6 months of expenses',
        'Keeping the money in a high-yield savings account',
        'Investing the entire fund in stocks',
        'Starting small and building gradually'
      ],
      correctAnswer: 2,
      explanation: 'Emergency funds should be easily accessible and low-risk, making stocks inappropriate due to their volatility.'
    },
    {
      id: 3,
      question: 'What is a credit score primarily used for?',
      options: [
        'To determine your annual income',
        'To evaluate your creditworthiness for loans',
        'To calculate your tax obligations',
        'To track your spending habits'
      ],
      correctAnswer: 1,
      explanation: 'Credit scores help lenders assess the risk of lending money to you, affecting loan approvals and interest rates.'
    },
    {
      id: 4,
      question: 'Which investment typically offers the highest potential return but also the highest risk?',
      options: [
        'Savings account',
        'Government bonds',
        'Individual stocks',
        'Certificate of deposit (CD)'
      ],
      correctAnswer: 2,
      explanation: 'Individual stocks offer high growth potential but come with significant risk of loss, especially in the short term.'
    },
    {
      id: 5,
      question: 'What does diversification mean in investing?',
      options: [
        'Putting all money in one stock',
        'Spreading investments across different asset types',
        'Only investing in bonds',
        'Timing the market perfectly'
      ],
      correctAnswer: 1,
      explanation: 'Diversification reduces risk by spreading investments across different assets, sectors, and geographic regions.'
    },
    {
      id: 6,
      question: 'What is the recommended debt-to-income ratio for most lenders?',
      options: [
        'Below 20%',
        'Below 36%',
        'Below 50%',
        'Below 75%'
      ],
      correctAnswer: 1,
      explanation: 'Most lenders prefer a debt-to-income ratio below 36%, with housing costs not exceeding 28% of gross income.'
    },
    {
      id: 7,
      question: 'What is inflation?',
      options: [
        'A decrease in the general price level',
        'An increase in the general price level',
        'A type of investment return',
        'A government tax policy'
      ],
      correctAnswer: 1,
      explanation: 'Inflation is the rate at which the general level of prices rises, reducing the purchasing power of money over time.'
    },
    {
      id: 8,
      question: 'Which retirement account allows for tax-free withdrawals in retirement?',
      options: [
        'Traditional 401(k)',
        'Traditional IRA',
        'Roth IRA',
        'Pension plan'
      ],
      correctAnswer: 2,
      explanation: 'Roth IRAs are funded with after-tax dollars, allowing for tax-free withdrawals in retirement.'
    },
    {
      id: 9,
      question: 'What is the purpose of insurance?',
      options: [
        'To guarantee investment returns',
        'To transfer financial risk',
        'To avoid paying taxes',
        'To increase credit score'
      ],
      correctAnswer: 1,
      explanation: 'Insurance transfers the financial risk of potential losses from individuals to insurance companies in exchange for premiums.'
    },
    {
      id: 10,
      question: 'What is the 50/30/20 budgeting rule?',
      options: [
        '50% savings, 30% needs, 20% wants',
        '50% needs, 30% wants, 20% savings',
        '50% wants, 30% needs, 20% savings', 
        '50% taxes, 30% savings, 20% spending'
      ],
      correctAnswer: 1,
      explanation: 'The 50/30/20 rule suggests allocating 50% of income to needs, 30% to wants, and 20% to savings and debt repayment.'
    }
  ]
};