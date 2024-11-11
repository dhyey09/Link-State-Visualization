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
        self.lsdb = {}      # Link State Database
        self.routing_table = {}  # {destination: {'next_hop': router, 'cost': cost}}
        self.sequence_number = 0
        
    def create_lsp(self, max_forwards=3):  # Default max forwards of 3
        """Create Link State Packet with Maximum Forwards"""
        self.sequence_number += 1
        return {
        'router_id': self.name,
        'sequence_number': self.sequence_number,
        'neighbors': self.neighbors,
        'max_forwards': max_forwards,  # Maximum number of times packet can be forwarded
        'forwards_used': 0,  # Track number of times forwarded
        'creation_time': datetime.now().isoformat()
    }
        
    def add_neighbor(self, neighbor, cost):
        self.neighbors[neighbor] = cost
        
    def remove_neighbor(self, neighbor):
        if neighbor in self.neighbors:
            del self.neighbors[neighbor]
            
    def update_lsdb(self, lsp):
        """Update Link State Database with received LSP"""
        router_id = lsp['router_id']
        if (router_id not in self.lsdb or 
            lsp['sequence_number'] > self.lsdb[router_id]['sequence_number']):
            self.lsdb[router_id] = lsp
            return True
        return False

def create_network(routers, links):
    """Create a network of routers from the provided topology"""
    network = {}
    # Create router instances
    for router in routers:
        network[router] = Router(router)
    
    # Add links between routers
    for link in links:
        network[link['source']].add_neighbor(link['target'], link['cost'])
        network[link['target']].add_neighbor(link['source'], link['cost'])
    
    return network

def get_next_hop(previous, destination):
    """Determine the next hop for reaching the destination"""
    if destination not in previous:
        return None
        
    current = destination
    while previous[current] is not None:
        if previous[previous[current]] is None:  # We've reached one hop from source
            return current
        current = previous[current]
    return current

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, float) and math.isinf(obj):
            return "Infinity"
        return super().default(obj)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/create_topology', methods=['POST'])
def create_topology():
    """Create initial network topology"""
    data = request.get_json()
    network = create_network(data['routers'], data['links'])
    return jsonify({'status': 'success', 'message': 'Topology created successfully'})

@app.route('/start_discovery', methods=['POST'])
def start_discovery():
    data = request.get_json()
    network = create_network(data['routers'], data['links'])
    discovery_steps = simulate_neighbor_discovery(network)
    return jsonify({'steps': discovery_steps})

@app.route('/start_flooding', methods=['POST'])
def start_flooding():
    data = request.get_json()
    network = create_network(data['routers'], data['links'])
    flooding_steps = simulate_flooding(network,int(data['TTL']))
    return jsonify({'steps': flooding_steps})

@app.route('/build_routing_tables', methods=['POST'])
def build_routing_tables():
    data = request.get_json()
    network = create_network(data['routers'], data['links'])
    routing_tables = build_all_routing_tables(network)
    return jsonify({'routing_tables': routing_tables})

@app.route('/calculate', methods=['POST'])
def calculate():
    data = request.get_json()
    
    # Create network from input data
    network = create_network(data['routers'], data['links'])
    
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
    
    response = {
        'distances': distances,
        'paths': paths,
        'history': history,
        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    return app.response_class(
        response=json.dumps(response, cls=CustomJSONEncoder),
        status=200,
        mimetype='application/json'
    )

def simulate_neighbor_discovery(network):
    """Simulate the neighbor discovery process"""
    steps = []
    for router_name, router in network.items():
        step = {
            'router': router_name,
            'discovered_neighbors': list(router.neighbors.keys()),
            'costs': router.neighbors,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        steps.append(step)
    return steps

def simulate_flooding(network, max_forwards=3):
    """Simulate the LSP flooding process with forward limit"""
    steps = []
    for router_name, router in network.items():
        lsp = router.create_lsp(max_forwards=max_forwards)
        
        flood_step = {
            'source_router': router_name,
            'lsp': lsp,
            'reached_routers': [],
            'dropped_routers': [],
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Track routers that receive and drop the packet
        for target_router_name, target_router in network.items():
            if target_router_name != router_name:
                # Create a copy of LSP to track forwarding
                forwarded_lsp = lsp.copy()
                forwarded_lsp['forwards_used'] += 1
                
                if forwarded_lsp['forwards_used'] <= forwarded_lsp['max_forwards']:
                    # Successful packet transmission
                    target_router.update_lsdb(forwarded_lsp)
                    flood_step['reached_routers'].append(target_router_name)
                else:
                    # Packet dropped due to max forwards reached
                    flood_step['dropped_routers'].append(target_router_name)
        
        steps.append(flood_step)
    
    return steps

def build_all_routing_tables(network):
    """Build routing tables for all routers in the network"""
    routing_tables = {}
    for router_name in network:
        distances, previous, _ = dijkstra(network, router_name)
        routing_table = {}
        for dest in network:
            if dest != router_name:
                next_hop = get_next_hop(previous, dest)
                routing_table[dest] = {
                    'next_hop': next_hop,
                    'cost': distances[dest] if not math.isinf(distances[dest]) else "Infinity"
                }
        routing_tables[router_name] = routing_table
    return routing_tables


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

if __name__ == '__main__':
    app.run(debug=True)