<template>
    <tr>
        <td>
            <div class="input-group">
                <input
                    class="form-control"
                    v-bind:value="username"
                    v-on:input="$emit('input-username', $event.target.value)"
                />
                <div class="input-group-append">
                    <span class="input-group-text">@chadwickschool.org</span>
                </div>
            </div>
        </td>
        <td><input
            class="form-control"
            v-bind:value="name"
            v-on:input="$emit('input-name', $event.target.value)"
        /></td>
        <td>
            <select
                class="form-control"
                v-bind:value="isMale"
                v-on:change="$emit('input-is-male', $event.target.value)"
            >
                <option value="true">Male</option>
                <option value="false">Female</option>
            </select>
        </td>
        <td>
            <button class="btn btn-primary" v-on:click="$emit('click-save')">Save</button>
        </td>
    </tr>
</template>

<script>
export default {
    name: 'EditingUserRow',
    props: ['username', 'name', 'isMale', 'onClickSave'],


}
</script>
