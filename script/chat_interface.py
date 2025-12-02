import sys
import json
import logging
import importlib
import os

# Configure logging to stderr to avoid polluting stdout (which is used for output)
logging.basicConfig(level=logging.ERROR, stream=sys.stderr)
logger = logging.getLogger(__name__)

def main():
    try:
        # Check arguments for script name
        if len(sys.argv) < 2:
            logger.error("Script name argument missing")
            print(json.dumps({"error": "Script name argument missing"}))
            return

        script_name = sys.argv[1]
        stream_mode = '--stream' in sys.argv
        
        # Remove .py extension if present
        if script_name.endswith('.py'):
            module_name = script_name[:-3]
        else:
            module_name = script_name
        # Read input from stdin
        input_data = sys.stdin.read()
        print(input_data)
        if not input_data:
            logger.error("No input data received")
            return

        data = json.loads(input_data)
        messages = data.get('messages', [])
        
        if not messages:
            print(json.dumps({"error": "No messages provided"}))
            return

        # Extract latest message and history
        last_message = messages[-1]
        query = last_message.get('content', '')
        
        # Format history
        history_messages = messages[:-1]
        chat_history = ""
        for msg in history_messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            chat_history += f"{role}: {content}\n"

        # Dynamically import the module
        try:
            module = importlib.import_module(module_name)
        except ImportError as e:
            logger.error(f"Failed to import module {module_name}: {str(e)}")
            print(json.dumps({"error": f"Failed to import module {module_name}: {str(e)}"}))
            return

        # Initialize assistant
        if not hasattr(module, 'get_sql_assistant'):
             logger.error(f"Module {module_name} does not have get_sql_assistant function")
             print(json.dumps({"error": f"Module {module_name} does not have get_sql_assistant function"}))
             return

        assistant = module.get_sql_assistant()
        
        # Connect to DB
        db_host = os.getenv('SCRIPT_DB_HOST', 'localhost')
        db_user = os.getenv('SCRIPT_DB_USER', 'yogesh')
        db_password = os.getenv('SCRIPT_DB_PASSWORD', 'nvidiagt710')
        db_name = os.getenv('SCRIPT_DB_NAME', 'ai-chatbot')
        
        assistant.connect_db(
            user=db_user,
            password=db_password,
            host=db_host,
            database=db_name
        )

        # Get available tables
        tables = ["apar_mapping_qa_data","apar_profiling_qa_data","apar_order_taking_qa_data"]
        
        if stream_mode:
            # Use streaming mode
            if not hasattr(assistant, 'ask_stream'):
                logger.error(f"Module {module_name} does not support streaming")
                print(json.dumps({"error": f"Module {module_name} does not support streaming"}))
                return
            
            # Stream responses line by line
            for event in assistant.ask_stream(query, tables, chat_history):
                # Each event is already a JSON string from ask_stream
                print(event)
                sys.stdout.flush()
        else:
            # Use non-streaming mode
            response = assistant.ask(query, tables, chat_history)
            print(json.dumps({"response": response}))

    except Exception as e:
        logger.error(f"Error in chat_interface: {str(e)}")
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
