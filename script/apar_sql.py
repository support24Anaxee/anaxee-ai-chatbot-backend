import os
import re
import json
import csv
import io
from typing import Dict, List, Optional, Any
from contextlib import contextmanager
from sqlalchemy import create_engine, inspect, text, Engine
from sqlalchemy.exc import SQLAlchemyError
from groq import Groq
from google import genai
from google.genai import types
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()


class DatabaseConnectionError(Exception):
    """Raised when database connection fails"""
    pass


class SchemaRetrievalError(Exception):
    """Raised when schema retrieval fails"""
    pass


class QueryExecutionError(Exception):
    """Raised when SQL query execution fails"""
    pass


class SQLAssistant:
    """
    A SQL assistant that connects to MySQL databases and answers natural language
    queries by generating and executing SQL queries using AI models.
    """
    
    # Supported AI providers
    PROVIDER_GROQ = "groq"
    PROVIDER_GEMINI = "gemini"
    
    # Model configurations
    MODELS = {
        PROVIDER_GROQ: "llama-3.3-70b-versatile",
        PROVIDER_GEMINI: "gemini-3-pro-preview"
    }

    def __init__(self, provider: str = PROVIDER_GEMINI):
        """
        Initialize the SQL Assistant.
        
        Args:
            provider: AI provider to use ('groq' or 'gemini')
        """
        self.engine: Optional[Engine] = None
        self.provider = provider
        self._initialize_client()
        
    def _initialize_client(self):
        """Initialize the AI client based on provider"""
        if self.provider == self.PROVIDER_GROQ:
            self.client = Groq()
            self.model = self.MODELS[self.PROVIDER_GROQ]
        elif self.provider == self.PROVIDER_GEMINI:
            self.client = genai.Client()
            self.model = self.MODELS[self.PROVIDER_GEMINI]
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
        
        logger.info(f"Initialized {self.provider} client with model {self.model}")

    def connect_db(self, user: str, password: str, host: str, database: str, 
                   port: int = 3306, **kwargs) -> Dict[str, str]:
        """
        Establishes a connection to the MySQL database.
        
        Args:
            user: Database username
            password: Database password
            host: Database host
            database: Database name
            port: Database port (default: 3306)
            **kwargs: Additional connection parameters
            
        Returns:
            Dictionary with status and message
        """
        try:
            # Construct connection string with proper encoding
            connection_string = (
                f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
                f"?charset=utf8mb4"
            )
            
            # Add pool configuration for better performance
            self.engine = create_engine(
                connection_string,
                pool_pre_ping=True,  # Verify connections before using
                pool_recycle=3600,   # Recycle connections after 1 hour
                echo=kwargs.get('echo', False)
            )
            
            # Test connection
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            logger.info(f"Successfully connected to database: {database}")
            return {"status": "success", "message": "Connected to database successfully"}
            
        except SQLAlchemyError as e:
            logger.error(f"Database connection failed: {str(e)}")
            raise DatabaseConnectionError(f"Failed to connect to database: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during connection: {str(e)}")
            raise DatabaseConnectionError(f"Unexpected connection error: {str(e)}")

    @contextmanager
    def _get_connection(self):
        """Context manager for database connections"""
        if not self.engine:
            raise DatabaseConnectionError("Database not connected. Call connect_db() first.")
        
        connection = self.engine.connect()
        try:
            yield connection
        finally:
            connection.close()

    def get_table_schema_as_csv(self, table_names: List[str]) -> str:
        """
        Retrieves table schema as CSV formatted string for multiple tables.
        
        Args:
            table_names: List of table names
            
        Returns:
            CSV formatted string with column information for all tables
        """
        try:
            with self._get_connection() as connection:
                # Validate table exists
                inspector = inspect(connection)
                available_tables = inspector.get_table_names()
                
                combined_output = io.StringIO()
                writer = csv.writer(combined_output)
                writer.writerow(['Table_Name', 'Column_Name', 'Type', 'Nullable', 'Sample_Content'])

                for table_name in table_names:
                    if table_name not in available_tables:
                        logger.warning(f"Table '{table_name}' not found. Skipping.")
                        continue
                    
                    # Fetch column metadata
                    columns = inspector.get_columns(table_name)

                    # Fetch sample row
                    sample_query = text(f"SELECT * FROM `{table_name}` LIMIT 1")
                    result = connection.execute(sample_query)
                    first_row = result.mappings().fetchone()

                    for col in columns:
                        name = col['name']
                        type_ = str(col['type'])
                        nullable = 'YES' if col.get('nullable', True) else 'NO'
                        sample = first_row[name] if first_row else None
                        writer.writerow([table_name, name, type_, nullable, sample])

                logger.info(f"Retrieved schema for tables: {table_names}")
                return combined_output.getvalue()
                
        except SchemaRetrievalError:
            raise
        except Exception as e:
            logger.error(f"Error retrieving schema: {str(e)}")
            raise SchemaRetrievalError(f"Failed to retrieve schema: {str(e)}")

    def extract_sql_query(self, text: str) -> str:
        """
        Extracts SQL query string from markdown code blocks or raw text.
        
        Args:
            text: Text potentially containing SQL query
            
        Returns:
            Cleaned SQL query string
        """
        # Try to extract from code blocks
        pattern = r"```(?:sql)?\s*(.*?)\s*```"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        
        if match:
            return match.group(1).strip()
        
        # Remove common prefixes if present
        text = re.sub(r'^(?:sql query:?|query:?)\s*', '', text, flags=re.IGNORECASE)
        return text.strip()

    def _generate_sql_query(self, table_names: List[str], schema: str, 
                           user_query: str, chat_history: str = "") -> str:
        """
        Generates SQL query using AI model.
        
        Args:
            table_names: List of table names
            schema: Table schema in CSV format
            user_query: User's natural language query
            chat_history: Previous conversation context
            
        Returns:
            Generated SQL query
        """
        
        # Check for specific business rules
        special_tables = {"apar_mapping_qa_data", "apar_profiling_qa_data", "apar_order_taking_qa_data"}
        is_special_case = special_tables.issubset(set(table_names))
        
        business_rules = ""
        if is_special_case:
            business_rules = """
1. Priority: Default = apar_order_taking_qa_data; use apar_mapping_qa_data only for mapping, apar_profiling_qa_data only for profiling.

2. Filters:
   Qa_Status='QA Approved'          -- profiling
   Qa_Status='QA Approved' AND State_Name NOT IN ('Maharashtra')   -- mapping
   Is_Shopkeeper_Ready_To_Place_Order='Yes'
   AND (QA_Status IS NULL OR QA_Status NOT IN ('Hold','QA Rejected'))
   AND Delivery_Status__By_Apar='Order Delivered'  -- only if asking delivered orders

3. Join:
   FROM apar_profiling_qa_data
   LEFT JOIN apar_order_taking_qa_data ON Shop_Code_For_Metabase = Formulated_Shop_Code
   LEFT JOIN apar_mapping_qa_data ON Shop_Code_For_Metabase = FormId

4. Unique for apar_order_taking_qa_data:
   DISTINCT O_Shop_Code = unique orders
   DISTINCT Formulated_Shop_Code = unique shops

5. Revenue:
   DO NOT use Total_Order_Value Column
   ALWAYS use Order_Price for revenue, totals, averages, etc.
"""

        prompt = f"""Table Names: {', '.join(table_names)}

Schema:
{schema}

Chat History:
{chat_history}

Question: {user_query}"""

        system_instruction = f"""Required Output: SQL Query String

Instructions:
1. Generate a MySQL query that answers the user's question based on the provided schema
2. Retrieve all relevant information to provide complete context
3. Return ONLY the SQL query with no titles, explanations, or markdown
4. For text field comparisons, use LOWER() function and wildcards: LOWER(field) LIKE '%value%'
5. Use backticks for table and column names to handle reserved words
6. If the question is unrelated to the schema, respond with: "NO_RELEVANT_DATA"
7. Optimize for readability with proper formatting
8. Use JOINs where appropriate if relationships are evident
{business_rules}
"""

        try:
            if self.provider == self.PROVIDER_GEMINI:
                response = self.client.models.generate_content(
                    model=self.model,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.0
                    ),
                    contents=[prompt]
                )
                return response.text
            else:  # Groq
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0
                )
                return response.choices[0].message.content
                
        except Exception as e:
            logger.error(f"Error generating SQL query: {str(e)}")
            raise

    def _execute_query(self, sql_query: str) -> List[Dict[str, Any]]:
        """
        Executes SQL query and returns results.
        
        Args:
            sql_query: SQL query to execute
            
        Returns:
            List of result rows as dictionaries
        """
        try:
            with self._get_connection() as connection:
                result = connection.execute(text(sql_query))
                rows = [dict(row._mapping) for row in result]
                logger.info(f"Query executed successfully. Rows returned: {len(rows)}")
                return rows
                
        except SQLAlchemyError as e:
            logger.error(f"SQL execution error: {str(e)}")
            raise QueryExecutionError(f"Query execution failed: {str(e)}\nQuery: {sql_query}")

    def _generate_response(self, context: str, user_query: str, 
                          chat_history: str = "") -> str:
        """
        Generates natural language response from query results.
        
        Args:
            context: Query results as JSON
            user_query: Original user query
            chat_history: Previous conversation context
            
        Returns:
            Natural language response
        """
        prompt = f"""Context (Query Results):
{context}

Chat History:
{chat_history}

User Query: {user_query}"""

        system_instruction = """You are a helpful SQL assistant. Using the provided query results:
1. Answer the user's question accurately and concisely
2. Present data in a clear, readable format
3. Use tables or lists when appropriate for multiple records
4. Highlight key insights or patterns
5. If no results were found, explain that clearly
6. Maintain a natural, conversational tone
7. Reference specific numbers and facts from the results
"""

        try:
            if self.provider == self.PROVIDER_GEMINI:
                response = self.client.models.generate_content(
                    model=self.model,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.3
                    ),
                    contents=[prompt]
                )
                return response.text
            else:  # Groq
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3
                )
                return response.choices[0].message.content
                
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise

    def _generate_response_stream(self, context: str, user_query: str, 
                                  chat_history: str = ""):
        """
        Generates natural language response from query results as a stream.
        
        Args:
            context: Query results as JSON
            user_query: Original user query
            chat_history: Previous conversation context
            
        Yields:
            Chunks of the response
        """
        prompt = f"""Context (Query Results):
{context}

Chat History:
{chat_history}

User Query: {user_query}"""

        system_instruction = """You are a helpful SQL assistant. Using the provided query results:
1. Answer the user's question accurately and concisely
2. Present data in a clear, readable format
3. Use tables or lists when appropriate for multiple records
4. Highlight key insights or patterns
5. If no results were found, explain that clearly
6. Maintain a natural, conversational tone
7. Reference specific numbers and facts from the results
"""

        try:
            if self.provider == self.PROVIDER_GEMINI:
                response = self.client.models.generate_content_stream(
                    model=self.model,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.3
                    ),
                    contents=[prompt]
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
            else:  # Groq
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    stream=True
                )
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                
        except Exception as e:
            logger.error(f"Error generating response stream: {str(e)}")
            yield f"Error generating response: {str(e)}"

    def ask_stream(self, query: str, table_names: List[str], chat_history: str = ""):
        """
        Main function to handle user queries through the complete pipeline with streaming.
        
        Args:
            query: User's natural language query
            table_names: List of tables to query
            chat_history: Previous conversation context
            
        Yields:
            JSON strings representing events:
            - {"type": "status", "content": "..."}
            - {"type": "content", "content": "..."}
            - {"type": "metadata", ...}
        """
        try:
            # Step 1: Get Schema
            yield json.dumps({"type": "status", "content": "Analyzing database schema..."})
            schema = self.get_table_schema_as_csv(table_names)
            
            # Step 2: Generate SQL
            yield json.dumps({"type": "status", "content": "Generating SQL query..."})
            sql_query_raw = self._generate_sql_query(table_names, schema, query, chat_history)
            sql_query = self.extract_sql_query(sql_query_raw)
            
            # Check for irrelevant query
            if "NO_RELEVANT_DATA" in sql_query or "no relevant data" in sql_query.lower():
                yield json.dumps({"type": "content", "content": "I couldn't find relevant data in the table for your query."})
                return
            
            logger.info(f"Generated SQL: {sql_query}")
            yield json.dumps({"type": "status", "content": "Executing SQL query..."})
            
            # Step 3: Execute SQL
            rows = self._execute_query(sql_query)
            
            if not rows:
                yield json.dumps({"type": "content", "content": "Your query executed successfully, but no results were found."})
                return
            
            # Step 4: Generate Response
            yield json.dumps({"type": "status", "content": "Formulating response..."})
            json_output = json.dumps(rows, indent=2, default=str)
            
            # Stream the response
            full_response = ""
            for chunk in self._generate_response_stream(json_output, query, chat_history):
                full_response += chunk
                yield json.dumps({"type": "content", "content": chunk})
            
            yield json.dumps({"type": "metadata", "sql": sql_query, "row_count": len(rows)})
            
        except (DatabaseConnectionError, SchemaRetrievalError, QueryExecutionError) as e:
            yield json.dumps({"type": "error", "content": f"Error: {str(e)}"})
        except Exception as e:
            logger.error(f"Unexpected error in ask_stream(): {str(e)}", exc_info=True)
            yield json.dumps({"type": "error", "content": f"An unexpected error occurred: {str(e)}"})

    def ask(self, query: str, table_names: List[str], chat_history: str = "") -> str:
        """
        Main function to handle user queries through the complete pipeline.
        
        Args:
            query: User's natural language query
            table_names: List of tables to query
            chat_history: Previous conversation context
            
        Returns:
            Natural language response to the query
        """
        try:
            # Step 1: Get Schema
            schema = self.get_table_schema_as_csv(table_names)
            
            # Step 2: Generate SQL
            sql_query_raw = self._generate_sql_query(table_names, schema, query, chat_history)
            sql_query = self.extract_sql_query(sql_query_raw)
            
            # Check for irrelevant query
            if "NO_RELEVANT_DATA" in sql_query or "no relevant data" in sql_query.lower():
                return "I couldn't find relevant data in the table for your query."
            
            logger.info(f"Generated SQL: {sql_query}")
            
            # Step 3: Execute SQL
            rows = self._execute_query(sql_query)
            
            if not rows:
                return "Your query executed successfully, but no results were found."
            
            # Step 4: Generate Response
            json_output = json.dumps(rows, indent=2, default=str)
            response = self._generate_response(json_output, query, chat_history)
            
            return response
            
        except (DatabaseConnectionError, SchemaRetrievalError, QueryExecutionError) as e:
            return f"Error: {str(e)}"
        except Exception as e:
            logger.error(f"Unexpected error in ask(): {str(e)}", exc_info=True)
            return f"An unexpected error occurred: {str(e)}"

    def get_available_tables(self) -> List[str]:
        """
        Returns list of available tables in the connected database.
        
        Returns:
            List of table names
        """
        try:
            with self._get_connection() as connection:
                inspector = inspect(connection)
                tables = inspector.get_table_names()
                logger.info(f"Available tables: {tables}")
                return tables
        except Exception as e:
            logger.error(f"Error getting tables: {str(e)}")
            return []

    def disconnect(self):
        """Closes database connection and cleans up resources"""
        if self.engine:
            self.engine.dispose()
            self.engine = None
            logger.info("Database connection closed")


# Global instance with lazy initialization
_sql_assistant_instance = None

def get_sql_assistant(provider: str = SQLAssistant.PROVIDER_GEMINI) -> SQLAssistant:
    """
    Returns singleton instance of SQLAssistant.
    
    Args:
        provider: AI provider to use
        
    Returns:
        SQLAssistant instance
    """
    global _sql_assistant_instance
    if _sql_assistant_instance is None:
        _sql_assistant_instance = SQLAssistant(provider=provider)
    return _sql_assistant_instance


# For backward compatibility
sql_assistant = get_sql_assistant()