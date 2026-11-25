package dev.agentropolis.worldq.xr

// Local state only. No camera, renderer, network or Android permission APIs.
data class Pose(val x: Double, val y: Double, val z: Double,
                val scale: Double = 1.0, val yaw: Double = 0.0)
enum class Session { STOPPED, DENIED, UNSUPPORTED, TRACKING, LOST }
class SpatialState {
    var session = Session.STOPPED
        private set
    var pose: Pose? = null
        private set
    var selected = false
        private set
    val asset = "UNVERIFIED_PLACEHOLDER"
    fun start(supported: Boolean, permission: Boolean) {
        reset()
        session = if (!supported) Session.UNSUPPORTED else if (!permission) Session.DENIED else Session.TRACKING
    }
    fun trackingLost() {
        if (session == Session.TRACKING) {
            session = Session.LOST
            selected = false
        }
    }
    fun trackingRecovered() {
        if (session == Session.LOST) session = Session.TRACKING
    }
    fun place(x: Double, y: Double, z: Double, planeHit: Boolean): Boolean {
        if (session != Session.TRACKING || !planeHit || !listOf(x,y,z).all { it.isFinite() }) return false
        pose = Pose(x,y,z)
        selected = true
        return true
    }
    fun select(hit: Boolean) {
        selected = session == Session.TRACKING && pose != null && hit
    }
    fun transform(dx: Double, dz: Double, factor: Double, twist: Double): Boolean {
        val p = pose ?: return false
        if (session != Session.TRACKING || !selected || factor <= 0 || !listOf(dx,dz,factor,twist).all { it.isFinite() }) return false
        val x = p.x + dx
        val z = p.z + dz
        val yaw = (p.yaw + twist) % 360
        if (!listOf(x,z,yaw).all { it.isFinite() }) return false
        pose = p.copy(x=x,z=z,scale=(p.scale*factor).coerceIn(0.25,4.0),yaw=yaw)
        return true
    }
    fun reset() { pose = null; selected = false; session = Session.STOPPED }
}
fun main() {
    val s = SpatialState()
    s.start(true,false); check(!s.place(0.0,0.0,0.0,true))
    s.start(false,true); check(s.session == Session.UNSUPPORTED)
    s.start(true,true); check(!s.place(0.0,0.0,0.0,false))
    check(s.place(0.0,0.0,0.0,true))
    check(s.transform(1.0,2.0,10.0,90.0)); check(s.pose == Pose(1.0,0.0,2.0,4.0,90.0))
    s.select(false); check(!s.transform(1.0,0.0,1.0,0.0))
    s.select(true); check(!s.transform(Double.NaN,0.0,1.0,0.0))
    s.trackingLost(); check(!s.transform(1.0,0.0,1.0,0.0))
    s.trackingRecovered(); check(!s.selected)
    s.reset(); check(s.pose == null && s.session == Session.STOPPED)
    println("WORLDQ XR synthetic state checks passed")
}
