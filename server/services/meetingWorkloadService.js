import Meeting from "../models/meetingModel.js";
import Membership from "../models/membershipModel.js";

class MeetingWorkloadService {
  /**
   * Get team meeting workload metrics for an organization over a specific time window.
   * @param {String} organizationId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Array>} Array of workload objects for each user
   */
  static async getTeamWorkload(organizationId, startDate, endDate) {
    // Ensure dates are defined
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days
    const end = endDate || new Date();

    // Fetch all active members in the organization
    const memberships = await Membership.find({
      organization: organizationId,
      status: "active",
    }).populate("user", "name email avatarUrl");

    // Initialize user map with default metrics
    const userMap = new Map();
    memberships.forEach((m) => {
      if (m.user) {
        userMap.set(m.user._id.toString(), {
          user: m.user,
          totalMeetings: 0,
          totalMinutes: 0,
          role: m.role || "member",
        });
      }
    });

    // Fetch meetings in the organization within the time frame
    const meetings = await Meeting.find({
      organization: organizationId,
      deletedAt: null,
      date: { $gte: start, $lte: end },
    }).lean();

    // Process meetings
    meetings.forEach((meeting) => {
      const durationMins = meeting.duration || 60; // Default to 60 mins if not specified

      if (meeting.participants && Array.isArray(meeting.participants)) {
        meeting.participants.forEach((p) => {
          if (
            p.user &&
            (p.rsvpStatus === "accepted" ||
              p.rsvpStatus === "tentative" ||
              p.rsvpStatus === "pending")
          ) {
            const userIdStr = p.user.toString();
            if (userMap.has(userIdStr)) {
              const stats = userMap.get(userIdStr);
              stats.totalMeetings += 1;
              stats.totalMinutes += durationMins;
            }
          }
        });
      }
    });

    // Compute derived metrics
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const workloads = Array.from(userMap.values()).map((w) => {
      const totalHours = w.totalMinutes / 60;
      const avgMeetingsPerDay = w.totalMeetings / days;

      // Determine risk status
      let riskStatus = "healthy";
      if (avgMeetingsPerDay > 6 || totalHours > days * 4) {
        riskStatus = "overloaded";
      } else if (avgMeetingsPerDay > 4 || totalHours > days * 2.5) {
        riskStatus = "at_risk";
      }

      return {
        ...w,
        totalHours,
        avgMeetingsPerDay,
        riskStatus,
      };
    });

    // Sort by total hours descending
    workloads.sort((a, b) => b.totalHours - a.totalHours);

    return workloads;
  }

  /**
   * Get an individual user's meeting workload heatmap data for an organization.
   * Returns a 7x24 array where arr[dayOfWeek][hour] is the count of meetings.
   * dayOfWeek: 0 = Sunday, 1 = Monday, etc.
   * @param {String} organizationId
   * @param {String} userId
   * @param {Date} startDate
   * @param {Date} endDate
   */
  static async getUserHeatmap(organizationId, userId, startDate, endDate) {
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const meetings = await Meeting.find({
      organization: organizationId,
      deletedAt: null,
      date: { $gte: start, $lte: end },
      "participants.user": userId,
      "participants.rsvpStatus": { $in: ["accepted", "tentative", "pending"] },
    }).lean();

    // Initialize 7x24 grid
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));

    meetings.forEach((meeting) => {
      if (meeting.date) {
        const meetingDate = new Date(meeting.date);
        const day = meetingDate.getDay();

        let startHour = meetingDate.getHours();

        // Use meeting.time if date object doesn't have time correctly set
        if (meeting.time) {
          const [hours] = meeting.time.split(":");
          startHour = parseInt(hours, 10);
        }

        const durationHours = Math.ceil((meeting.duration || 60) / 60);

        for (let i = 0; i < durationHours; i++) {
          const hour = (startHour + i) % 24;
          heatmap[day][hour] += 1;
        }
      }
    });

    return heatmap;
  }
}

export default MeetingWorkloadService;
