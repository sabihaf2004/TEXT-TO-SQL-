### Project Introduction — ClarifySQL

**ClarifySQL** is an AI-powered **Text-to-SQL system** that allows users to interact with company databases using simple natural-language questions instead of writing SQL queries.

The system works with business data such as **customers, orders, and payments**. When a user asks a question like *“How many new customers signed up each month?”*, ClarifySQL understands the question, generates the appropriate SQL query, executes it against the database, and presents the result in an easy-to-understand format. 

The key feature of ClarifySQL is its **Intent-Aware Clarification Engine**. Instead of making assumptions when a question is ambiguous, the system asks the user for clarification. For example, if the user asks *“Who are our best customers?”*, the system can ask whether “best” means **highest revenue, most orders, or highest average order value**. This helps prevent incorrect SQL queries and misleading results. 

The system also uses a **real-data ingestion pipeline**, where customer, order, and payment data can be imported through CSV files. It validates the data and dynamically discovers the database schema, allowing the AI to generate queries based on the actual available tables and columns rather than relying on hardcoded sample data.  

**In simple terms:**

> **User asks a question → ClarifySQL understands the intent → asks for clarification if needed → generates SQL → queries the real database → returns the answer.**

This makes database analysis more accessible to users who may not have SQL expertise.
