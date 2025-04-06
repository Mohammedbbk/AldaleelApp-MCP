from flask import Flask, request, jsonify
import os
import requests
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

TRIPADVISOR_API_KEY = os.getenv('TRIPADVISOR_API_KEY')
TRIPADVISOR_API_URL = 'https://api.content.tripadvisor.com/api/v1'

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

@app.route('/locations', methods=['GET'])
def search_locations():
    try:
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
        return jsonify({'error': str(e)}), 500

@app.route('/location/<location_id>/details', methods=['GET'])
def get_location_details(location_id):
    try:
        response = requests.get(
            f'{TRIPADVISOR_API_URL}/location/{location_id}/details',
            headers={'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY}
        )
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('TRIPADVISOR_PORT', 8006))
    app.run(host='0.0.0.0', port=port)