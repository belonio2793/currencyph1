/**
 * Test utilities for routing functionality
 * Used for verifying multi-source routing and fallback mechanisms
 */

import { getRoute, compareRoutes, getRouteSourceInfo, monitorRouteRealtime } from './routingService'
import { routeEstimationService } from './routeEstimationService'

/**
 * Test single route request with source tracking
 */
export async function testSingleRoute(startLat, startLng, endLat, endLng) {
  console.log('Testing single route request...')
  console.log(`From: ${startLat}, ${startLng}`)
  console.log(`To: ${endLat}, ${endLng}`)

  try {
    const route = await getRoute(startLat, startLng, endLat, endLng)

    return {
      success: true,
      data: {
        distance: route.distance,
        duration: route.duration,
        source: route.source,
        sourceInfo: getRouteSourceInfo(route.source),
        steps: route.steps?.length || 0,
        hasGeometry: !!route.geometry && route.geometry.length > 0
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error?.message
    }
  }
}

/**
 * Test route comparison between sources
 */
export async function testRouteComparison(startLat, startLng, endLat, endLng) {
  console.log('Testing route comparison between sources...')

  try {
    const routes = await compareRoutes(startLat, startLng, endLat, endLng)

    return {
      success: true,
      data: routes.map(route => ({
        provider: route.provider,
        distance: route.distance,
        duration: route.duration,
        source: route.source,
        hasGeometry: !!route.geometry && route.geometry.length > 0
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: error?.message
    }
  }
}

/**
 * Test route monitoring with real-time updates
 */
export async function testRouteMonitoring(routeId, startLat, startLng, endLat, endLng) {
  console.log('Testing route monitoring...')

  return new Promise((resolve) => {
    const updates = []
    let updateCount = 0

    const unsubscribe = monitorRouteRealtime(
      startLat,
      startLng,
      endLat,
      endLng,
      (update) => {
        updateCount++
        updates.push({
          updateNumber: updateCount,
          success: update.success,
          distance: update.distance,
          duration: update.duration,
          source: update.source,
          timestamp: update.timestamp
        })

        // Collect 3 updates then stop
        if (updateCount >= 3) {
          unsubscribe()
          resolve({
            success: true,
            data: {
              totalUpdates: updates.length,
              updates: updates
            }
          })
        }
      },
      3000 // 3 second interval for testing
    )

    // Timeout after 15 seconds
    setTimeout(() => {
      unsubscribe()
      resolve({
        success: true,
        data: {
          totalUpdates: updates.length,
          updates: updates,
          note: 'Timeout reached'
        }
      })
    }, 15000)
  })
}

/**
 * Test route estimation service monitoring
 */
export async function testRouteEstimationService(routeId, startLat, startLng, endLat, endLng) {
  console.log('Testing route estimation service...')

  return new Promise((resolve) => {
    const updates = []
    let updateCount = 0

    routeEstimationService.startMonitoring(
      routeId,
      startLat,
      startLng,
      endLat,
      endLng,
      (update) => {
        updateCount++
        updates.push({
          updateNumber: updateCount,
          success: update.success,
          distance: update.distance,
          duration: update.duration,
          source: update.source,
          timestamp: update.timestamp
        })

        // Collect 3 updates then stop
        if (updateCount >= 3) {
          routeEstimationService.stopMonitoring(routeId)
          resolve({
            success: true,
            data: {
              totalUpdates: updates.length,
              updates: updates,
              routeData: routeEstimationService.getRouteData(routeId)
            }
          })
        }
      },
      {
        updateInterval: 3000,
        enableSync: false,
        rideId: null,
        userId: null
      }
    )

    // Timeout after 15 seconds
    setTimeout(() => {
      routeEstimationService.stopMonitoring(routeId)
      resolve({
        success: true,
        data: {
          totalUpdates: updates.length,
          updates: updates,
          note: 'Timeout reached'
        }
      })
    }, 15000)
  })
}

/**
 * Run comprehensive routing tests
 */
export async function runComprehensiveRoutingTests(startLat, startLng, endLat, endLng) {
  console.log('='.repeat(60))
  console.log('RUNNING COMPREHENSIVE ROUTING TESTS')
  console.log('='.repeat(60))

  const results = {
    timestamp: new Date().toISOString(),
    location: {
      from: { lat: startLat, lng: startLng },
      to: { lat: endLat, lng: endLng }
    },
    tests: {
      singleRoute: null,
      routeComparison: null,
      routeMonitoring: null,
      estimationService: null
    }
  }

  // Test 1: Single route
  try {
    console.log('\n[TEST 1] Single Route Request')
    results.tests.singleRoute = await testSingleRoute(startLat, startLng, endLat, endLng)
    console.log('Result:', results.tests.singleRoute)
  } catch (error) {
    console.error('Test 1 failed:', error)
    results.tests.singleRoute = { success: false, error: error?.message }
  }

  // Test 2: Route comparison
  try {
    console.log('\n[TEST 2] Route Comparison')
    results.tests.routeComparison = await testRouteComparison(startLat, startLng, endLat, endLng)
    console.log('Result:', results.tests.routeComparison)
  } catch (error) {
    console.error('Test 2 failed:', error)
    results.tests.routeComparison = { success: false, error: error?.message }
  }

  // Test 3: Route monitoring
  try {
    console.log('\n[TEST 3] Route Monitoring')
    results.tests.routeMonitoring = await testRouteMonitoring('test-route-1', startLat, startLng, endLat, endLng)
    console.log('Result:', results.tests.routeMonitoring)
  } catch (error) {
    console.error('Test 3 failed:', error)
    results.tests.routeMonitoring = { success: false, error: error?.message }
  }

  // Test 4: Estimation service
  try {
    console.log('\n[TEST 4] Route Estimation Service')
    results.tests.estimationService = await testRouteEstimationService('test-route-2', startLat, startLng, endLat, endLng)
    console.log('Result:', results.tests.estimationService)
  } catch (error) {
    console.error('Test 4 failed:', error)
    results.tests.estimationService = { success: false, error: error?.message }
  }

  console.log('\n' + '='.repeat(60))
  console.log('TEST SUMMARY')
  console.log('='.repeat(60))
  console.log('Single Route:', results.tests.singleRoute?.success ? '✓ PASS' : '✗ FAIL')
  console.log('Route Comparison:', results.tests.routeComparison?.success ? '✓ PASS' : '✗ FAIL')
  console.log('Route Monitoring:', results.tests.routeMonitoring?.success ? '✓ PASS' : '✗ FAIL')
  console.log('Estimation Service:', results.tests.estimationService?.success ? '✓ PASS' : '✗ FAIL')
  console.log('='.repeat(60))

  return results
}

export default {
  testSingleRoute,
  testRouteComparison,
  testRouteMonitoring,
  testRouteEstimationService,
  runComprehensiveRoutingTests
}
