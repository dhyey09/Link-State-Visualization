from flask import Flask, render_template, request, jsonify
import heapq
import json
from datetime import datetime
import math

app = Flask(__name__)

class Router:
    def __init__(self, name):
        self.name = name
        self.neighbors = {}  # {neighbor_name: cost}
        
    def add_neighbor(self, neighbor, cost):
        self.neighbors[neighbor] = cost
        
    def remove_neighbor(self, neighbor):
        if neighbor in self.neighbors:
            del self.neighbors[neighbor]

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, float) and math.isinf(obj):
            return "Infinity"
        return super().default(obj)

def dijkstra(network, start):
    distances = {router: float('infinity') for router in network}
    distances[start] = 0
    pq = [(0, start)]
    previous = {router: None for router in network}
    path_history = []  # To store algorithm steps
    visited = set()
    
    while pq:
        current_distance, current_router = heapq.heappop(pq)
        
        if current_router in visited:
            continue
            
        visited.add(current_router)
        
        # Record detailed step information
        step_info = {
            'current': current_router,
            'distances': {k: (v if not math.isinf(v) else "Infinity") for k, v in distances.items()},
            'previous': {k: v for k, v in previous.items() if v is not None},
            'visited': list(visited),
            'queue': [(d, r) for d, r in pq],  # Current priority queue
            'neighbors': {
                n: {
                    'cost': w,
                    'total_distance': current_distance + w,
                    'current_best': "Infinity" if math.isinf(distances[n]) else distances[n]
                }
                for n, w in network[current_router].neighbors.items()
                if n not in visited
            }
        }
        path_history.append(step_info)
        
        for neighbor, weight in network[current_router].neighbors.items():
            if neighbor in visited:
                continue
                
            distance = current_distance + weight
            
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous[neighbor] = current_router
                heapq.heappush(pq, (distance, neighbor))
    
    return distances, previous, path_history

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    data = request.get_json()
    
    # Create network from input data
    network = {}
    for router in data['routers']:
        network[router] = Router(router)
    
    for link in data['links']:
        network[link['source']].add_neighbor(link['target'], link['cost'])
        network[link['target']].add_neighbor(link['source'], link['cost'])
    
    # Calculate shortest paths from source
    source = data['source']
    distances, previous, history = dijkstra(network, source)
    
    # Convert infinity values to strings
    distances = {k: (v if not math.isinf(v) else "Infinity") for k, v in distances.items()}
    
    # Construct paths with detailed information
    paths = {}
    for target in network:
        if target != source:
            path = []
            current = target
            path_cost = 0
            while current is not None:
                path.append(current)
                if previous[current] is not None:
                    path_cost += network[previous[current]].neighbors[current]
                current = previous[current]
            paths[target] = {
                'path': list(reversed(path)),
                'cost': path_cost,
                'hops': len(path) - 1
            }
    
    # Add timestamp for logging
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    response = {
        'distances': distances,
        'paths': paths,
        'history': history,
        'timestamp': timestamp
    }
    
    return app.response_class(
        response=json.dumps(response, cls=CustomJSONEncoder),
        status=200,
        mimetype='application/json'
    )

if __name__ == '__main__':
    app.run(debug=True)