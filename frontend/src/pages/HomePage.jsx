import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, User, Shield, UserPlus, LogIn } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

export default function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedRole, setSelectedRole] = useState('user');

  const handleRegister = async (role) => {
    if (!phone || !name) {
      toast.error('Phone and name are required');
      return;
    }

    if (role === 'driver' && !vehicleNo) {
      toast.error('Vehicle number is required for driver');
      return;
    }

    setLoading(true);
    try {
      if (role === 'driver') {
        // Register driver
        const response = await api.post('/api/driver/register', {
          name,
          phone,
          vehicleNo,
        });

        if (response.data.success) {
          toast.success('Driver registered successfully!');
          // IMPORTANT: Login as driver with role="driver" to get proper driver token
          // Don't reuse any existing token
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          await handleLogin('driver');
        }
      } else {
        // Register user
        const response = await api.post('/api/auth/register', {
          name,
          phone,
          role: 'user',
        });

        if (response.data.success) {
          toast.success('Account created successfully!');
          // IMPORTANT: Clear any existing tokens and login fresh
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          await handleLogin('user');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (role) => {
    if (!phone) {
      toast.error('Please enter phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        phone,
        role,
      });

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('role', role);
        toast.success('Login successful!');

        if (role === 'user') {
          navigate('/user');
        } else if (role === 'driver') {
          navigate('/driver');
        } else if (role === 'admin') {
          navigate('/admin');
        }
      }
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Account not found. Please register first.');
        setIsRegistering(true);
        setSelectedRole(role);
      } else {
        toast.error(error.response?.data?.message || 'Login failed');
      }
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Truck className="w-20 h-20 text-red-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🚑 Ambulance Dispatch
          </h1>
          <p className="text-gray-600">Emergency Response Platform</p>
        </div>

        {/* Toggle Register/Login */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setIsRegistering(false)}
            className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors ${
              !isRegistering
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LogIn className="w-4 h-4 inline mr-2" />
            Login
          </button>
          <button
            onClick={() => setIsRegistering(true)}
            className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors ${
              isRegistering
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            Register
          </button>
        </div>

        {isRegistering ? (
          /* REGISTRATION FORM */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Register as
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedRole('user')}
                  className={`py-2 px-4 rounded-lg font-semibold transition-colors ${
                    selectedRole === 'user'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <User className="w-4 h-4 inline mr-2" />
                  User
                </button>
                <button
                  onClick={() => setSelectedRole('driver')}
                  className={`py-2 px-4 rounded-lg font-semibold transition-colors ${
                    selectedRole === 'driver'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Truck className="w-4 h-4 inline mr-2" />
                  Driver
                </button>
              </div>
            </div>

            {/* Vehicle Number (only for driver) */}
            {selectedRole === 'driver' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  placeholder="DL-01-AB-1234"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            <button
              onClick={() => handleRegister(selectedRole)}
              disabled={loading}
              className={`w-full text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                selectedRole === 'driver'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <UserPlus className="w-5 h-5" />
              {loading ? 'Creating Account...' : `Create ${selectedRole === 'driver' ? 'Driver' : 'User'} Account`}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <button
                onClick={() => setIsRegistering(false)}
                className="text-red-600 font-semibold hover:underline"
              >
                Login here
              </button>
            </p>
          </div>
        ) : (
          /* LOGIN FORM */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleLogin('user')}
                disabled={loading}
                className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <User className="w-5 h-5" />
                Login as User
              </button>

              <button
                onClick={() => handleLogin('driver')}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Truck className="w-5 h-5" />
                Login as Driver
              </button>

              <button
                onClick={() => handleLogin('admin')}
                disabled={loading}
                className="w-full bg-gray-800 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Shield className="w-5 h-5" />
                Login as Admin
              </button>
            </div>

            <p className="text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <button
                onClick={() => setIsRegistering(true)}
                className="text-red-600 font-semibold hover:underline"
              >
                Register here
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
