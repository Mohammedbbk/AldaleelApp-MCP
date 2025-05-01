import sys
from flask import Flask, request, jsonify
import os
import requests
from dotenv import load_dotenv

SERVICE_NAME = 'TripAdvisor Server'

try:
    print(f'[{SERVICE_NAME}] Loading environment variables...', file=sys.stderr)
    load_dotenv()
    print(f'[{SERVICE_NAME}] Environment variables loaded.', file=sys.stderr)
    
    app = Flask(__name__)

    TRIPADVISOR_API_KEY = os.getenv('TRIPADVISOR_API_KEY')
    if not TRIPADVISOR_API_KEY:
        print(f'[{SERVICE_NAME} Warning] TRIPADVISOR_API_KEY environment variable not set.', file=sys.stderr)
    else:
        print(f'[{SERVICE_NAME}] TripAdvisor API Key loaded.', file=sys.stderr)

    TRIPADVISOR_API_URL = 'https://api.content.tripadvisor.com/api/v1'
    
    print(f'[{SERVICE_NAME}] Flask app initialized.', file=sys.stderr)

except Exception as e:
    print(f'[{SERVICE_NAME} Error] Initialization failed: {e}', file=sys.stderr)
    sys.exit(1) # Exit if initialization fails

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

@app.route('/locations', methods=['GET'])
def search_locations():
    try:
        if not TRIPADVISOR_API_KEY:
             print(f'[{SERVICE_NAME} Error] Attempted search_locations but API key is missing.', file=sys.stderr)
             return jsonify({'error': 'Service configuration error: API key missing'}), 503
        query = request.args.get('query')
        if not query:
            return jsonify({'error': 'Query parameter is required'}), 400

        response = requests.get(
            f'{TRIPADVISOR_API_URL}/location/search',
            headers={'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY},
            params={'searchQuery': query}
        )
        return jsonify(response.json())
    except Exception as e:
        print(f'[{SERVICE_NAME} Error] in /locations: {e}', file=sys.stderr) # Log route errors
        return jsonify({'error': str(e)}), 500

@app.route('/location/<location_id>/details', methods=['GET'])
def get_location_details(location_id):
    try:
        if not TRIPADVISOR_API_KEY:
             print(f'[{SERVICE_NAME} Error] Attempted get_location_details but API key is missing.', file=sys.stderr)
             return jsonify({'error': 'Service configuration error: API key missing'}), 503
        response = requests.get(
            f'{TRIPADVISOR_API_URL}/location/{location_id}/details',
            headers={'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY}
        )
        return jsonify(response.json())
    except Exception as e:
        print(f'[{SERVICE_NAME} Error] in /location/<id>/details: {e}', file=sys.stderr) # Log route errors
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    try:
        port = int(os.getenv('TRIPADVISOR_PORT', 8006))
        print(f'[{SERVICE_NAME}] Flask app configured and ready to run on port {port}', file=sys.stderr)
        # Note: app.run() is blocking. Errors during Flask's internal startup might not be caught here.
        # For production, use a WSGI server like gunicorn or waitress.
        app.run(host='0.0.0.0', port=port)
    except Exception as e:
        # This will catch errors like the port being invalid, but not EADDRINUSE from app.run itself easily.
        print(f'[{SERVICE_NAME} Error] Failed to start Flask server: {e}', file=sys.stderr)
        sys.exit(1)