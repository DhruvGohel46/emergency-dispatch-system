import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import {
  AlertCircle, MapPin, Clock, Check, X, Navigation,
  RefreshCw, Truck, Radio, FileText
} from 'lucide-react';
import api from '../config/api';
import { connectSocket, getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const mapContainerStyle = {
  width: '100%',
  height: '100vh',
};

const defaultCenter = {
  lat: 20.5937, // Neutral center of India as broad fallback
  lng: 78.9629,
};

export default function DriverApp() {
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [driver, setDriver] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [directions, setDirections] = useState(null);
  const [eta, setEta] = useState(null);
  const [status, setStatus] = useState('offline');
  const [transferReason, setTransferReason] = useState('');
  const [loading, setLoading] = useState(true); // Add loading state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [socket, setSocket] = useState(null);
  const mapRef = useRef(null);
  const socketRef = useRef(null); // Keep ref for internal functions
  const locationIntervalRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const lastLocationUpdateRef = useRef(0); // For throttling location updates

  // Load driver profile on mount
  useEffect(() => {
    let isMounted = true;

    // 🚑 START TRACKING IMMEDIATELY (Like User App)
    startLocationTracking();
    connectWebSocket();

    loadDriverProfile()
      .then((driverData) => {
        if (isMounted && driverData) {
          console.log('✅ Driver profile loaded:', driverData.name);
          loadAssignments();
        }
      })
      .catch((error) => {
        if (!isMounted) return;

        console.error('Failed to load driver profile:', error);
        // Don't show error toast if already redirected
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          toast.error('Failed to load driver profile. Retrying...');
          // Retry after 2 seconds
          setTimeout(() => {
            if (isMounted) {
              loadDriverProfile().catch(() => { });
            }
          }, 2000);
        }
      });

    return () => {
      isMounted = false;
      // Cleanup GPS watch
      if (locationIntervalRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      // Cleanup socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync backend when driver profile is available
  useEffect(() => {
    const driverId = driver?.id || driver?._id;
    if (driverId && location) {
      updateDriverLocation(location);
    }
  }, [driver, location]);

  // Join WebSocket room and setup listeners when driver and socket are ready
  useEffect(() => {
    const driverId = driver?.id || driver?._id;
    if (!driverId || !socket) return;

    const setupListeners = () => {
      console.log(`📡 Setting up socket for driver: ${driverId}`);
      socket.emit('driver:join', { driverId });

      // Emergency request listener
      socket.off(`driver:${driverId}:request`);
      socket.on(`driver:${driverId}:request`, (data) => {
        console.log('🚨 Incoming emergency request:', data);
        setActiveRequest(data);
        setShowRequestModal(true);
        toast(`🚨 New Emergency Request!`, {
          duration: 30000,
          id: 'dispatch-alert',
          icon: '🚨',
        });
      });

      // 🚨 SYNC: Listen for assignments taken by other drivers
      socket.off('emergency:assigned');
      socket.on('emergency:assigned', (data) => {
        console.log('ℹ️ Sync: Emergency assigned to', data.driverId);

        // 🚨 ROOT CAUSE #2 FIX: Compare IDs correctly (handle different formats)
        const activeId = activeRequest?.emergencyId || activeRequest?._id || activeRequest?.emergency?._id;
        if (String(activeId) === String(data.emergencyId)) {
          setShowRequestModal(false);
          setActiveRequest(null);
          toast.dismiss('dispatch-alert');
        }

        // Deep nuke from assignments list
        setAssignments(prev => prev.filter(a => {
          const aId = a.emergencyId?._id || a.emergencyId?.id || a.emergencyId;
          return String(aId) !== String(data.emergencyId);
        }));
      });

      // 🚨 SYNC: Listen for transfers/redispatches
      socket.off('emergency:searching');
      socket.on('emergency:searching', (data) => {
        console.log('🔄 Sync: Emergency searching again:', data.emergencyId);
        loadAssignments(); // Refresh to catch the new request if we're nearby
      });
    };

    // Only setup listeners if socket exists
    if (socket) {
      if (socket.connected) {
        setupListeners();
      }

      socket.on('connect', setupListeners);
      socket.on('reconnect', setupListeners);
    }

    return () => {
      if (socket) {
        socket.off('connect', setupListeners);
        socket.off('reconnect', setupListeners);
        socket.off(`driver:${driverId}:request`);
      }
    };
  }, [driver, socket]);

  const loadDriverProfile = async () => {
    // Check if user is logged in and has driver role
    const token = localStorage.getItem('token');
    const storedRole = localStorage.getItem('role');

    if (!token) {
      toast.error('Not logged in. Please login as driver.');
      navigate('/');
      return;
    }

    if (storedRole !== 'driver') {
      toast.error('You are not logged in as driver. Please login as driver.');
      // Clear invalid token
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      navigate('/');
      return;
    }

    try {
      setLoading(true); // Set loading before API call
      const response = await api.get('/api/driver/me');
      if (response.data.success) {
        setDriver(response.data.driver);
        setStatus(response.data.driver.status);
        setLoading(false); // Clear loading on success
        if (response.data.driver.lat !== undefined && response.data.driver.lng !== undefined &&
          response.data.driver.lat !== 0 && response.data.driver.lng !== 0) {
          // Only use DB location if we don't have a fresh browser location yet
          setLocation(prev => prev || {
            lat: response.data.driver.lat,
            lng: response.data.driver.lng,
          });
        }
        return response.data.driver;
      }
    } catch (error) {
      setLoading(false); // Clear loading on error
      console.error('Load driver profile error:', error);
      console.error('Error details:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        token: token ? 'Present' : 'Missing',
        role: storedRole
      });

      if (error.response?.status === 401) {
        // Token expired or invalid - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        navigate('/');
        toast.error('Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        // Access denied - wrong role or driver not found
        const errorMsg = error.response?.data?.message || 'Access denied. Please login as driver.';
        toast.error(errorMsg);

        // Clear invalid token and redirect
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        navigate('/');
      } else {
        toast.error('Failed to load driver profile');
      }
      throw error;
    }
  };

  const connectWebSocket = () => {
    // Cleanup existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const token = localStorage.getItem('token');
    const newSocket = connectSocket(token);
    setSocket(newSocket);
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
    });

    newSocket.on('reconnect', () => {
      console.log('WebSocket reconnected');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    newSocket.on('location:updated', (data) => {
      console.log('Location update confirmed:', data);
    });

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

        // 🚑 AMBULANCE-GRADE GPS: Use watchPosition with accuracy filtering
    // This keeps scanning WiFi + Bluetooth + GPS until accuracy is good
    const geoOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000 // 15 seconds for better GPS acquisition
    };

    // Clean up any existing watch
    if (locationIntervalRef.current) {
      navigator.geolocation.clearWatch(locationIntervalRef.current);
    }

    // Use watchPosition instead of getCurrentPosition + interval
    // This continuously monitors GPS and improves accuracy over time
    locationIntervalRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        console.log(`📍 Driver GPS: ${latitude}, ${longitude} | Accuracy: ${Math.round(accuracy)}m`);

        // 🚨 FIX: Accept location with any accuracy but log warnings
        // GPS accuracy improves over time, so we update continuously
        if (accuracy > 200) {
          console.warn(`⚠️ Driver GPS accuracy low (${Math.round(accuracy)}m), but using location...`);
          if (accuracy > 500) {
            toast.loading(`Low accuracy GPS (${Math.round(accuracy)}m). Moving to better spot...`, { id: 'gps-loading', duration: 2000 });
          }
        }

        const newLocation = {
          lat: latitude,
          lng: longitude,
        };

        setLocation(newLocation);

        // 🚨 FIX: Always update backend if driver is loaded (don't wait for perfect accuracy)
        if (driver?.id || driver?._id) {
          updateDriverLocation(newLocation);
        }

        // Show success when accuracy is good
        if (accuracy <= 15) {
          toast.success(`✅ High accuracy GPS: ${Math.round(accuracy)}m`, { id: 'gps-success', duration: 2000 });
        } else if (accuracy <= 50 && !location) {
          toast.success(`Location locked!`, { id: 'gps-success', duration: 2000 });
        }
      },
      (error) => {
        console.error('GPS error:', error);
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

        if (!location) {
          setLocation(defaultCenter);
        }
      },
      geoOptions
    );
  };

  // Throttle location updates (max once per 3 seconds)
  const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds

  const updateDriverLocation = async (loc) => {
    const driverId = driver?.id || driver?._id;
    if (!driverId) {
      console.warn('⚠️ Cannot update location: Driver ID not available');
      return;
    }

    // Throttle: Only update if at least 3 seconds have passed since last update
    const now = Date.now();
    if (now - lastLocationUpdateRef.current < LOCATION_UPDATE_INTERVAL) {
      return; // Skip this update
    }
    lastLocationUpdateRef.current = now;

    try {
      const emergencyId = currentAssignment?.emergencyId?._id || emergency?._id || emergency?.id;

      // Don't send driverId - backend gets it from JWT token
      const response = await api.post('/api/driver/location', {
        lat: loc.lat,
        lng: loc.lng,
        emergencyId: emergencyId || undefined,
      });

      console.log(`✅ Location updated: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`);

      // Send via WebSocket too (real-time tracking)
      if (socketRef.current && driverId) {
        socketRef.current.emit('location', {
          driverId,
          lat: loc.lat,
          lng: loc.lng,
          emergencyId: emergencyId || undefined,
        });
      }
    } catch (error) {
      console.error('❌ Update location error:', error);
      // Don't show toast for location update errors (too noisy)
      // The next update will retry automatically
    }
  };

  const loadAssignments = async () => {
    try {
      // Use /me/assignments endpoint - backend gets driverId from JWT token
      const response = await api.get('/api/driver/me/assignments');
      if (response.data.success) {
        setAssignments(response.data.assignments.filter(a => a.status === 'pending'));
      }
    } catch (error) {
      console.error('Load assignments error:', error);
    }
  };

  const handleAccept = async (assignmentId, emergencyId) => {
    try {
      toast.loading('Accepting emergency...');
      // Don't send driverId - backend gets it from JWT token
      const response = await api.post('/api/driver/accept', {
        emergencyId,
      });

      if (response.data.success) {
        toast.dismiss();
        toast.success(`Mission Accepted! ${response.data.trafficNotifications?.sent || 0} authorities notified.`);
        setShowRequestModal(false);
        setActiveRequest(null);

        // 🚨 INSTANT SYNC: Join room before loading details
        if (socket && response.data.emergency) {
          const emergencyId = response.data.emergency.id || response.data.emergency._id || emergencyId;
          console.log('🔗 Joining emergency room instantly:', emergencyId);
          socket.emit('emergency:join', { emergencyId });
        }

        setCurrentAssignment(response.data.assignment);
        setEmergency(response.data.emergency);
        setStatus('busy');
        setEta(response.data.eta);

        // Load route with parsed coordinates
        if (location && response.data.emergency) {
          const destLat = parseFloat(response.data.emergency.lat);
          const destLng = parseFloat(response.data.emergency.lng);

          if (!isNaN(destLat) && !isNaN(destLng)) {
            loadRoute(location, {
              lat: destLat,
              lng: destLng,
            });
          } else {
            console.error('❌ Invalid emergency coordinates:', response.data.emergency);
          }
        }

        // Update driver status
        await api.post('/api/driver/status', {
          status: 'busy',
        });

        loadAssignments();
      }
    } catch (error) {
      toast.dismiss();
      toast.error(error.response?.data?.message || 'Failed to accept emergency');
    }
  };

  const handleReject = async (assignmentId, emergencyId) => {
    try {
      // Don't send driverId - backend gets it from JWT token
      const response = await api.post('/api/driver/reject', {
        emergencyId,
      });

      if (response.data.success) {
        toast.success('Emergency rejected');
        loadAssignments();
      }
    } catch (error) {
      // 🚨 Handle 404: Mission already taken by another driver
      if (error.response?.status === 404) {
        toast('Another driver already accepted', { icon: '⚡' });
        setShowRequestModal(false);
        setActiveRequest(null);
        // Clean up list
        setAssignments(prev => prev.filter(a =>
          (a.emergencyId?._id || a.emergencyId?.id || a.emergencyId) !== emergencyId
        ));
        return;
      }
      toast.error(error.response?.data?.message || 'Failed to reject emergency');
    }
  };

  const loadRoute = async (origin, destination) => {
    if (!mapRef.current) return;

    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: false,
    });

    directionsService.route(
      {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
          setDirections(result);

          // Calculate ETA
          const route = result.routes[0];
          const leg = route.legs[0];
          const durationMinutes = Math.ceil(leg.duration.value / 60);
          setEta({
            distance: leg.distance.text,
            duration: leg.duration.text,
            estimatedMinutes: durationMinutes,
          });
        } else {
          console.error('Directions error:', status);
          if (status === 'REQUEST_DENIED') {
            toast.error('Google Directions API is not enabled. Showing straight line fallback.', { id: 'api-error' });
            // 🚨 FALLBACK: Draw straight polyline if API denied
            const fallbackResult = {
              routes: [{
                bounds: null,
                copyrights: "",
                legs: [{
                  distance: { text: "Direct line", value: 0 },
                  duration: { text: "Est. 5 min", value: 300 },
                  start_location: origin,
                  end_location: destination,
                }],
                overview_path: [origin, destination],
                overview_polyline: "",
                warnings: ["Directions API Denied. Using fallback."],
                waypoint_order: []
              }]
            };
            setDirections(fallbackResult);
          } else {
            toast.error(`Route error: ${status}`);
          }
        }
      }
    );

    directionsServiceRef.current = directionsService;
    directionsRendererRef.current = directionsRenderer;
  };

  const handleReachedLocation = async () => {
    if (!emergency?._id) return;

    try {
      const response = await api.patch(`/api/emergency/${emergency._id}/status`, {
        status: 'reached',
      });

      if (response.data.success) {
        toast.success('Marked as reached! Now navigate to hospital.');
        // Update status to enroute (going to hospital)
        await api.patch(`/api/emergency/${emergency._id}/status`, {
          status: 'enroute',
        });
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleHospitalReached = async () => {
    if (!emergency?._id) return;

    try {
      const response = await api.patch(`/api/emergency/${emergency._id}/status`, {
        status: 'hospital',
      });

      if (response.data.success) {
        toast.success('Hospital reached!');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleComplete = async () => {
    if (!emergency?._id) return;

    try {
      const response = await api.patch(`/api/emergency/${emergency._id}/status`, {
        status: 'completed',
      });

      if (response.data.success) {
        toast.success('Emergency completed!');
        setEmergency(null);
        setCurrentAssignment(null);
        setDirections(null);
        setEta(null);
        setStatus('available');

        await api.post('/api/driver/status', {
          status: 'available',
        });
      }
    } catch (error) {
      toast.error('Failed to complete emergency');
    }
  };

  const handleTransfer = async () => {
    if (!emergency?._id || !transferReason.trim()) {
      toast.error('Please enter transfer reason');
      return;
    }

    if (!confirm('Are you sure you want to transfer this emergency?')) {
      return;
    }

    try {
      toast.loading('Transferring emergency...');
      const response = await api.post('/api/emergency/transfer', {
        emergencyId: emergency._id,
        reason: transferReason,
        useCurrentLocation: true, // Use ambulance's current GPS location
      });

      if (response.data.success) {
        toast.dismiss();
        toast.success('Emergency transferred! Another ambulance is being dispatched.');

        setEmergency(null);
        setCurrentAssignment(null);
        setDirections(null);
        setEta(null);
        setTransferReason('');
        setStatus('available');

        await api.post('/api/driver/status', {
          status: 'available',
        });
      }
    } catch (error) {
      toast.dismiss();
      toast.error(error.response?.data?.message || 'Failed to transfer emergency');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      // Don't send driverId - backend gets it from JWT token
      const response = await api.post('/api/driver/status', {
        status: newStatus,
      });

      if (response.data.success) {
        setStatus(newStatus);
        toast.success(`Status updated to ${newStatus}`);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Show loading during initial driver profile fetch
  if (loading && !driver) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading driver profile...</p>
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
      <LoadScript
        googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        libraries={['places']}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={location ? 15 : 12}
          onLoad={(map) => {
            mapRef.current = map;
          }}
        >
          {/* Driver Location Marker */}
          {mapCenter && (
            <Marker
              position={mapCenter}
              icon={{
                path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
                fillColor: '#3b82f6', // Blue for Driver
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 1.5,
              }}
              label="🚑"
            />
          )}

          {/* Emergency Location Marker */}
          {emergency && !isNaN(parseFloat(emergency.lat)) && !isNaN(parseFloat(emergency.lng)) && (
            <Marker
              position={{ lat: parseFloat(emergency.lat), lng: parseFloat(emergency.lng) }}
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

          {/* Directions Renderer Fallback using Polyline */}
          {directions && (!directions.routes || directions.routes.length === 0 || directions.routes[0].warnings?.includes("Directions API Denied. Using fallback.")) && (
            <Polyline
              path={directions.routes[0].overview_path}
              options={{
                strokeColor: '#ef4444',
                strokeWeight: 5,
                strokeOpacity: 0.8,
                lineDashStyle: [10, 5],
              }}
            />
          )}

          {/* Directions Renderer */}
          {directions && directions.routes && directions.routes.length > 0 && !directions.routes[0].warnings?.includes("Directions API Denied. Using fallback.") && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: false,
                polylineOptions: {
                  strokeColor: '#3b82f6',
                  strokeWeight: 4,
                  strokeOpacity: 0.8,
                },
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>

      {/* Top Panel - Status & Assignments */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-white rounded-lg shadow-xl p-4 max-w-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{driver.name}</h2>
              <p className="text-sm text-gray-600">{driver.vehicleNo}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange('available')}
                className={`px-3 py-1 rounded text-sm font-semibold ${status === 'available'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700'
                  }`}
              >
                Available
              </button>
              <button
                onClick={() => handleStatusChange('offline')}
                className={`px-3 py-1 rounded text-sm font-semibold ${status === 'offline'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-200 text-gray-700'
                  }`}
              >
                Offline
              </button>
            </div>
          </div>

          {/* Pending Assignments */}
          {assignments.length > 0 && !emergency && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {assignments.map((assignment) => {
                const emergencyData = assignment.emergencyId;
                return (
                  <div
                    key={assignment._id}
                    className="p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-red-700">🚨 Emergency Request</p>
                        <p className="text-xs text-gray-600">
                          {isValidCoord(emergencyData?.lat) ? parseFloat(emergencyData.lat).toFixed(4) : '0.0000'},
                          {isValidCoord(emergencyData?.lng) ? parseFloat(emergencyData.lng).toFixed(4) : '0.0000'}
                        </p>
                        <p className="text-xs text-gray-600">
                          Caller: {emergencyData?.userPhone}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleAccept(assignment._id, emergencyData?._id)}
                        className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm font-semibold hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 inline mr-1" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(assignment._id, emergencyData?._id)}
                        className="flex-1 bg-red-600 text-white py-2 px-3 rounded text-sm font-semibold hover:bg-red-700"
                      >
                        <X className="w-4 h-4 inline mr-1" />
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Emergency */}
          {emergency && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-600">Emergency Status</p>
                <p className="font-semibold text-red-600 capitalize">{emergency.status}</p>
              </div>

              {eta && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <p className="text-xs text-gray-600">ETA</p>
                  </div>
                  <p className="font-semibold text-blue-700">
                    {eta.estimatedMinutes} minutes
                  </p>
                  <p className="text-xs text-gray-600">{eta.distance}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {emergency.status === 'assigned' && (
                  <button
                    onClick={handleReachedLocation}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    <MapPin className="w-5 h-5 inline mr-2" />
                    Reached Location
                  </button>
                )}

                {emergency.status === 'enroute' && (
                  <button
                    onClick={handleHospitalReached}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Truck className="w-5 h-5 inline mr-2" />
                    Reached Hospital
                  </button>
                )}

                {emergency.status === 'hospital' && (
                  <button
                    onClick={handleComplete}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    <Check className="w-5 h-5 inline mr-2" />
                    Complete Emergency
                  </button>
                )}

                {/* Transfer Button */}
                {(emergency.status === 'assigned' || emergency.status === 'enroute') && (
                  <div className="border-t pt-2 mt-2">
                    <input
                      type="text"
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      placeholder="Transfer reason (e.g., Tyre puncture)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                    />
                    <button
                      onClick={handleTransfer}
                      className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                    >
                      <RefreshCw className="w-5 h-5 inline mr-2" />
                      Transfer Emergency
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🚨 EMERGENCY POP-UP MODAL (Pulse Animation) */}
      {showRequestModal && activeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 animate-in fade-in transition-all">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300 ring-4 ring-red-500 ring-opacity-50 pulse-red">
            <div className="bg-red-600 p-6 text-center text-white">
              <div className="inline-block p-4 rounded-full bg-white bg-opacity-20 mb-4 animate-bounce">
                <AlertCircle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-black mb-1">EMERGENCY</h2>
              <p className="text-red-100 font-bold uppercase tracking-widest text-sm">Response Required</p>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4 text-gray-700">
                  <div className="p-3 bg-red-50 rounded-xl">
                    <MapPin className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">Distance</p>
                    <p className="text-xl font-black text-gray-900">{activeRequest.distance || '0'} meters away</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-gray-700">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Radio className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">Patient Contact</p>
                    <p className="text-lg font-bold text-gray-900">{activeRequest.userPhone}</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 space-y-3">
                <button
                  onClick={() => handleAccept(null, activeRequest.emergencyId)}
                  className="w-full bg-green-600 text-white py-5 rounded-xl font-black text-xl hover:bg-green-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check className="w-6 h-6" /> ACCEPT MISSION
                </button>
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    handleReject(null, activeRequest.emergencyId);
                    // Also remove from assignments list locally to be safe
                    setAssignments(prev => prev.filter(a =>
                      (a.emergencyId?._id || a.emergencyId?.id || a.emergencyId) !== activeRequest.emergencyId
                    ));
                  }}
                  className="w-full bg-gray-100 text-gray-500 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95"
                >
                  IGNORE REQUEST
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-4 text-center">
              <p className="text-xs text-gray-400 italic">Lives are at stake. Please respond immediately.</p>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for the pulse animation */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .pulse-red {
          animation: pulse-red 2s infinite;
        }
      `}} />
    </div>
  );
}
