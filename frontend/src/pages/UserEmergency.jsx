import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { AlertCircle, MapPin, Clock, Truck, X, RefreshCw, Check } from 'lucide-react';
import api from '../config/api';
import { connectSocket, getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const mapContainerStyle = {
  width: '100%',
  height: '100vh',
};

const defaultCenter = {
  lat: 28.6139,
  lng: 77.2090,
};

export default function UserEmergency() {
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [driver, setDriver] = useState(null);
  const [route, setRoute] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [directions, setDirections] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    // 🚑 AMBULANCE-GRADE GPS: Use watchPosition with accuracy filtering
    if (navigator.geolocation) {
      const geoOptions = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000 // Reduced to 10s for faster acquisition
      };

      // Use watchPosition instead of getCurrentPosition
      // This continuously monitors GPS and improves accuracy over time: 800m → 400m → 120m → 30m → 10m
      // Clean up any existing watch
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;

          console.log(`📍 GPS: ${latitude}, ${longitude} | Accuracy: ${Math.round(accuracy)}m`);

          // 🚑 RESILIENT GPS: Accept any location but log accuracy
          // Accuracy improves over time - show feedback but don't block
          if (accuracy > 100) {
            console.warn(`⚠️ GPS accuracy low (${Math.round(accuracy)}m), still using this location...`);
            if (accuracy > 500) {
              toast.loading(`Low accuracy GPS (${Math.round(accuracy)}m). Try going near a window.`, { id: 'gps-loading', duration: 2000 });
            }
          }

          // Accuracy is good enough - use this location
          const userLocation = {
            lat: latitude,
            lng: longitude,
          };
          setLocation(userLocation);

          // Show success when accuracy is good
          if (accuracy <= 15) {
            toast.success(`✅ High accuracy GPS: ${Math.round(accuracy)}m`, { id: 'gps-success' });
          } else if (accuracy <= 100) {
            toast.success(`Location detected (Accuracy: ${Math.round(accuracy)}m)`, { id: 'gps-success' });
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMsg = 'GPS Error: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg += 'Location permission denied. Please allow location access.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg += 'Location unavailable. Trying to get GPS signal...';
              break;
            case error.TIMEOUT:
              errorMsg += 'GPS timeout. Trying again...';
              break;
            default:
              errorMsg += error.message;
          }
          toast.error(errorMsg, { duration: 5000 });
          // If already have a location, don't reset to default
          if (!location) {
            setLocation(defaultCenter);
          }
        },
        geoOptions
      );

      // Cleanup watch on unmount
      return () => {
        if (watchIdRef.current && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };
    } else {
      toast.error('Geolocation not supported by browser');
      setLocation(defaultCenter);
    }

    // Connect WebSocket
    const token = localStorage.getItem('token');
    const socket = connectSocket(token);
    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    // Listen for emergency updates when emergency is set
    if (emergency?.id && socketRef.current) {
      const emergencyId = emergency.id || emergency._id;
      console.log('🔗 Joining emergency room:', emergencyId);
      socketRef.current.emit('emergency:join', { emergencyId });

      socketRef.current.on(`track:${emergencyId}`, (data) => {
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          setDriverLocation({ lat, lng });
        }
      });

      socketRef.current.on(`emergency:${emergencyId}:assigned`, (data) => {
        setDriver(data.driver);
        toast.success(`Ambulance assigned: ${data.driver.name}`);
        loadEmergencyDetails(emergencyId);

        // Load route if driver assigned
        if (data.driver && emergency) {
          loadRoute(data.driver, emergency);
        }
      });

      socketRef.current.on(`emergency:${emergencyId}:status`, (data) => {
        console.log('📊 Emergency status update:', data.status);
        if (data.status === 'searching') {
          // 🚨 TRANSFER DETECTED: Clear old driver and show searching
          setDriver(null);
          setDriverLocation(null);
          toast('Ambulance transferred. Finding a new one...', { icon: '🔄', id: 'transfer-alert' });
        } else if (data.status === 'assigned') {
          // 🚨 ASSIGNED DETECTED: Trigger hydration
          console.log('✅ Mission Assigned! Hydrating details...');
          loadEmergencyDetails(emergencyId);
        }
        loadEmergencyDetails(emergencyId);
      });
    }

    return () => {
      if (socketRef.current && emergency?.id) {
        const emergencyId = emergency.id || emergency._id;
        socketRef.current.off(`track:${emergencyId}`);
        socketRef.current.off(`emergency:${emergencyId}:assigned`);
        socketRef.current.off(`emergency:${emergencyId}:status`);
      }
    };
  }, [emergency]);

  const loadEmergencyDetails = async (emergencyId) => {
    try {
      const response = await api.get(`/api/emergency/${emergencyId}`);
      if (response.data.emergency) {
        const emergencyData = response.data.emergency;
        // Ensure coordinates are numbers
        emergencyData.lat = parseFloat(emergencyData.lat);
        emergencyData.lng = parseFloat(emergencyData.lng);

        setEmergency(emergencyData);
        setDriver(emergencyData.assignedDriverId || response.data.driver);
        setTimeline(response.data.timeline || []);
      }
    } catch (error) {
      console.error('Load emergency error:', error);
    }
  };

  const loadRoute = async (driverData, emergencyData) => {
    if (!driverLocation || !emergencyData) return;

    try {
      // Route is handled by Google Maps DirectionsRenderer in DriverApp
      // For UserApp, we just show markers
    } catch (error) {
      console.error('Load route error:', error);
    }
  };

  const handleCreateEmergency = async () => {
    if (!location) {
      toast.error('Location not available');
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    try {
      toast.loading('Creating emergency...');
      const response = await api.post('/api/emergency/create', {
        phone: user.phone || '+1234567890',
        lat: location.lat,
        lng: location.lng,
      });

      if (response.data.success) {
        toast.dismiss();
        toast.success('Emergency created! Searching for ambulance...');
        setEmergency(response.data.emergency);

        // Load emergency details to get timeline
        await loadEmergencyDetails(response.data.emergency.id || response.data.emergency._id);

        // Join emergency room
        if (socketRef.current) {
          const emergencyId = response.data.emergency.id || response.data.emergency._id;
          socketRef.current.emit('emergency:join', { emergencyId });
        }
      }
    } catch (error) {
      toast.dismiss();
      toast.error(error.response?.data?.message || 'Failed to create emergency');
    }
  };

  const handleEditLocation = () => {
    const newLat = prompt('Enter new latitude:', location?.lat);
    const newLng = prompt('Enter new longitude:', location?.lng);

    if (newLat && newLng) {
      setLocation({ lat: parseFloat(newLat), lng: parseFloat(newLng) });
      toast.success('Location updated');
    }
  };

  if (!location) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Getting your location...</p>
        </div>
      </div>
    );
  }

  const isValidCoord = (coord) => coord !== null && coord !== undefined && !isNaN(parseFloat(coord));

  const mapCenter = (location && isValidCoord(location.lat) && isValidCoord(location.lng))
    ? { lat: parseFloat(location.lat), lng: parseFloat(location.lng) }
    : defaultCenter;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Map */}
      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={15}
          onLoad={(map) => (mapRef.current = map)}
        >
          {/* Emergency Location Marker */}
          {location && (
            <Marker
              position={location}
              icon={{
                path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 1.5,
              }}
              label="🚨"
            />
          )}

          {/* Driver Location Marker */}
          {driverLocation && !isNaN(parseFloat(driverLocation.lat)) && !isNaN(parseFloat(driverLocation.lng)) && (
            <Marker
              position={{ lat: parseFloat(driverLocation.lat), lng: parseFloat(driverLocation.lng) }}
              icon={{
                path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
                fillColor: '#3b82f6', // Blue for Driver
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 1.2,
              }}
              label="🚑"
            />
          )}

          {/* Route Polyline */}
          {route && route.polyline && (
            <Polyline
              path={route.polyline}
              options={{
                strokeColor: '#3b82f6',
                strokeWeight: 4,
                strokeOpacity: 0.8,
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>

      {/* Control Panel */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-white rounded-lg shadow-xl p-4 max-w-md">
          {!emergency ? (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-600" />
                Create Emergency
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Your location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateEmergency}
                  className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  🚨 Create Emergency
                </button>
                <button
                  onClick={handleEditLocation}
                  className="bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  title="Edit Location"
                >
                  <MapPin className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Emergency Active</h2>
                <button
                  onClick={() => {
                    setEmergency(null);
                    setDriver(null);
                    setDriverLocation(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-600">Status</p>
                  <p className="font-semibold text-red-600 capitalize">{emergency.status}</p>
                </div>

                {driver && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600">Driver</p>
                    <p className="font-semibold">{driver.name}</p>
                    <p className="text-sm text-gray-600">Vehicle: {driver.vehicleNo}</p>
                  </div>
                )}

                {driverLocation && (
                  <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                    <Truck className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-600">Ambulance Location</p>
                      <p className="text-sm font-semibold">Live Tracking Active</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline */}
              {timeline.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Timeline</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {timeline.map((event, idx) => (
                      <div key={idx} className="text-xs text-gray-600">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {event.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
