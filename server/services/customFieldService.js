import CustomFieldDefinition from "../models/customFieldDefinitionModel.js";
import CustomFieldValue from "../models/customFieldValueModel.js";
import Meeting from "../models/meetingModel.js";

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option) => typeof option === "string")
    .map((option) => option.trim())
    .filter(Boolean);
}

class CustomFieldService {
  async createDefinition(orgId, data) {
    const options = normalizeOptions(data.options);
    if (data.type === "dropdown" && options.length === 0) {
      throw new Error("Dropdown fields require options");
    }
    const def = new CustomFieldDefinition({
      organization: orgId,
      name: data.name,
      type: data.type,
      options: data.type === "dropdown" ? options : undefined,
      required: Boolean(data.required),
    });
    await def.save();
    return def;
  }

  async getDefinitions(orgId, activeOnly = true) {
    const query = { organization: orgId };
    if (activeOnly) {
      query.active = true;
    }
    return CustomFieldDefinition.find(query).sort({ createdAt: 1 });
  }

  async updateDefinition(id, orgId, data) {
    const def = await CustomFieldDefinition.findOne({
      _id: id,
      organization: orgId,
    });
    if (!def) throw new Error("Definition not found");

    if (data.name !== undefined) def.name = data.name;
    if (data.required !== undefined) def.required = data.required;
    if (data.active !== undefined) def.active = data.active;
    if (data.options !== undefined) {
      const options = normalizeOptions(data.options);
      if (def.type === "dropdown" && options.length === 0) {
        throw new Error("Dropdown fields require options");
      }
      def.options = def.type === "dropdown" ? options : undefined;
    }

    await def.save();
    return def;
  }

  async deleteDefinition(id, orgId) {
    return this.updateDefinition(id, orgId, { active: false });
  }

  async setMeetingFields(meetingId, orgId, fieldsData) {
    const definitions = await CustomFieldDefinition.find({
      organization: orgId,
      active: true,
    });
    const defMap = new Map(definitions.map((d) => [d._id.toString(), d]));

    const bulkOps = [];
    const providedFields = new Set();
    const meetingCustomFields = [];

    for (const field of fieldsData) {
      const def = defMap.get(field.definitionId);
      if (!def) continue;

      providedFields.add(field.definitionId);

      this.validateValue(field.value, def);

      bulkOps.push({
        updateOne: {
          filter: { meeting: meetingId, fieldDefinition: field.definitionId },
          update: { $set: { value: field.value } },
          upsert: true,
        },
      });

      meetingCustomFields.push({
        key: def.name,
        name: def.name,
        value: field.value,
        definitionId: def._id,
      });
    }

    for (const def of definitions) {
      if (def.required && !providedFields.has(def._id.toString())) {
        throw new Error(`Field ${def.name} is required`);
      }
    }

    const providedIds = Array.from(providedFields);
    await CustomFieldValue.deleteMany({
      meeting: meetingId,
      fieldDefinition: { $nin: providedIds },
    });

    if (bulkOps.length > 0) {
      await CustomFieldValue.bulkWrite(bulkOps);
    }

    // Sync customFields array directly to Meeting model for fast query & details access
    await Meeting.findByIdAndUpdate(meetingId, {
      $set: { customFields: meetingCustomFields },
    });
  }

  validateValue(value, definition) {
    if (value === null || value === undefined || value === "") {
      if (definition.required) {
        throw new Error(`Field ${definition.name} is required`);
      }
      return;
    }

    switch (definition.type) {
      case "number":
        if (typeof value !== "number" && isNaN(Number(value))) {
          throw new Error(`Field ${definition.name} must be a number`);
        }
        break;
      case "checkbox":
        if (
          typeof value !== "boolean" &&
          value !== "true" &&
          value !== "false"
        ) {
          throw new Error(`Field ${definition.name} must be a boolean`);
        }
        break;
      case "date":
        if (isNaN(Date.parse(value))) {
          throw new Error(`Field ${definition.name} must be a valid date`);
        }
        break;
      case "dropdown":
        if (definition.options && !definition.options.includes(value)) {
          throw new Error(
            `Value ${value} is not a valid option for ${definition.name}`,
          );
        }
        break;
      case "text":
      default:
        break;
    }
  }

  async getMeetingFields(meetingId) {
    return CustomFieldValue.find({ meeting: meetingId }).populate(
      "fieldDefinition",
    );
  }
}

export default new CustomFieldService();
